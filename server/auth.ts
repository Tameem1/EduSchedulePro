import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Extend the session type definition
declare module 'express-session' {
  interface SessionData {
    persistentLogin?: boolean;
    userId?: number;
    lastLogin?: string;
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Set up session middleware with specific settings for Replit environment
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: true, 
    saveUninitialized: true, // Changed to true to ensure session is created for all visitors
    store: storage.sessionStore,
    cookie: {
      secure: false, // Must be false for Replit non-HTTPS environments
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: 'lax' as 'lax', // 'lax' allows cookies to be sent with top-level navigation
      path: '/'
    },
    name: 'session_id',
  };

  app.set("trust proxy", 1);
  
  // Add cookie parser middleware before session
  app.use(cookieParser());
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Add debugging middleware
  app.use((req, res, next) => {
    console.log(`[Auth Debug] ${req.method} ${req.path} - isAuthenticated: ${req.isAuthenticated()}`);
    console.log(`[Auth Debug] Session ID: ${req.sessionID}`);
    next();
  });

  passport.use(
    new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    }, async (req, username, password, done) => {
      try {
        // Get section from request body
        const section = req.body.section;
        
        if (!section) {
          return done(null, false, { message: 'Section is required' });
        }
        
        // Find user by username AND section
        const user = await storage.getUserByUsernameAndSection(username, section);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: 'Invalid username, section, or password' });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if section is provided
      if (!req.body.section) {
        return res.status(400).json({ error: "Section is required" });
      }
      
      // Check if a user with the same username AND section already exists
      const existingUser = await storage.getUserByUsernameAndSection(
        req.body.username, 
        req.body.section
      );
      
      if (existingUser) {
        return res.status(400).json({ error: "A user with this username already exists in the selected section" });
      }

      // Create the user
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      
      // Log login attempt with session ID
      console.log(`[Auth Debug] Login attempt for user ${user.username} - Creating session`);
      
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Explicitly set a persistent property in the session
        req.session.persistentLogin = true;
        req.session.userId = user.id;
        req.session.lastLogin = new Date().toISOString();
        
        // Ensure the session is saved before responding
        req.session.save((err) => {
          if (err) return next(err);
          
          // Set a manual cookie as well to ensure persistence
          const cookieOptions = {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            path: '/',
            secure: false,
            sameSite: 'lax' as 'lax', // 'lax' allows cookies to be sent with top-level navigation
          };
          
          res.cookie('user_session', user.id.toString(), cookieOptions);
          
          console.log(`[Auth Debug] Login successful - Session ID: ${req.sessionID}`);
          console.log(`[Auth Debug] Setting persistent cookies and session data`);
          res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const sessionId = req.sessionID;
    console.log(`[Auth Debug] Logout request - Session ID: ${sessionId}`);
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        
        // Clear all auth-related cookies
        res.clearCookie('session_id');
        res.clearCookie('user_session');
        
        console.log(`[Auth Debug] Session and cookies cleared successfully`);
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    console.log(`[Auth Debug] User request - isAuthenticated: ${req.isAuthenticated()}`);
    
    // Check normal authentication
    if (req.isAuthenticated()) {
      console.log(`[Auth Debug] User authenticated via session`);
      return res.json(req.user);
    }
    
    // If not authenticated by session, try the fallback cookie
    const userIdFromCookie = req.cookies.user_session;
    if (userIdFromCookie) {
      try {
        console.log(`[Auth Debug] Attempting to authenticate via cookie: ${userIdFromCookie}`);
        
        // Get the user from storage
        const userId = parseInt(userIdFromCookie, 10);
        if (isNaN(userId)) {
          return res.sendStatus(401);
        }
        
        const user = await storage.getUser(userId);
        if (!user) {
          console.log(`[Auth Debug] No user found for ID: ${userId}`);
          return res.sendStatus(401);
        }
        
        // Log the user in
        req.login(user, (err) => {
          if (err) {
            console.error(`[Auth Debug] Error logging in user from cookie: ${err.message}`);
            return res.sendStatus(401);
          }
          
          console.log(`[Auth Debug] User authenticated via cookie: ${user.username}`);
          return res.json(user);
        });
      } catch (error) {
        console.error(`[Auth Debug] Error retrieving user from cookie:`, error instanceof Error ? error.message : String(error));
        return res.sendStatus(401);
      }
    } else {
      // No authentication found
      console.log(`[Auth Debug] No authentication found`);
      return res.sendStatus(401);
    }
  });
}