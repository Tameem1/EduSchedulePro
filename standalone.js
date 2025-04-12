// Simple standalone Express server
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simple Test App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #ddd;
          padding: 20px;
          border-radius: 5px;
        }
        h1 {
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Simple Express Server</h1>
        <p>If you can see this, the standalone Express server is working correctly!</p>
        <p>Current time: ${new Date().toLocaleString()}</p>
        <a href="/test.html">View Test Page</a>
      </div>
    </body>
    </html>
  `);
});

// Start server
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Standalone server running on port ${PORT}`);
});