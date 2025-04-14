import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'dev-secret-key',  // Added fallback
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false to work in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax', // Added for better security
    },
    name: 'session_id', // Added custom name
  };

  app.set("trust proxy", 1);
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
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.status(200).json(user);
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
        res.clearCookie('session_id');
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log(`[Auth Debug] User request - isAuthenticated: ${req.isAuthenticated()}`);
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}