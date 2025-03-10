import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import migrate from "./migrations/add_telegram_id"; // Added import for migration

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run database migrations
  try {
    await migrate();
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migrations failed:', error);
    // Continue startup even if migrations fail
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Run migration for telegram_phone
  try {
    const { default: addTelegramPhone } = await import('./migrations/add_telegram_phone');
    await addTelegramPhone();
    console.log('Migration for telegram_phone completed successfully');
  } catch (error) {
    console.error('Failed to run telegram_phone migration:', error);
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();


// Placeholder for migrations/add_telegram_id.js (This would be a proper migration file)
// This is a simplified example and needs to be adapted to your specific database library
// (e.g., using Sequelize, Prisma, etc.)
// const { sequelize } = require('./database'); // Import your database connection

// module.exports = async () => {
//   try {
//     await sequelize.sync(); //or sequelize.query('ALTER TABLE users ADD COLUMN telegram_id VARCHAR(255);')
//   } catch (error) {
//     console.error('Error running migration:', error);
//     throw error;
//   }
// };


// Placeholder for a registration form (React example)
// This is a very basic example and would need error handling and more robust functionality.
// import React, { useState } from 'react';

// function RegistrationForm() {
//   const [telegramId, setTelegramId] = useState('');

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     // Send data to backend API endpoint
//     const response = await fetch('/api/register', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ telegramId }),
//     });
//     //Handle response
//   };

//   return (
//     <form onSubmit={handleSubmit}>
//       <input
//         type="text"
//         placeholder="Telegram ID"
//         value={telegramId}
//         onChange={(e) => setTelegramId(e.target.value)}
//       />
//       <button type="submit">Register</button>
//     </form>
//   );
// }

// export default RegistrationForm;