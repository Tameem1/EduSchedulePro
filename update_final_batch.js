import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Use the same password hashing method as in auth.ts
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Small batch, focused on a specific range
async function updateSpecificRange(startId, endId) {
  try {
    console.log(`Processing users with IDs ${startId}-${endId}...`);
    
    // Read the JSON file to get the secret codes
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user IDs to secret codes for quick lookup
    const secretCodeMap = {};
    studentsData.forEach(student => {
      secretCodeMap[student.id] = student.secret_code;
    });
    
    // Get users within the specified range
    const result = await pool.query('SELECT id, username FROM users WHERE id >= $1 AND id <= $2', [startId, endId]);
    const users = result.rows;
    
    console.log(`Found ${users.length} users in range ${startId}-${endId}`);
    
    // Process each user
    for (const user of users) {
      try {
        // Get the secret code for this user
        const secretCode = secretCodeMap[user.id] || user.id.toString();
        
        // Hash the password using the application's method
        const hashedPassword = await hashPassword(secretCode);
        
        // Update the user's password
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
        
        console.log(`Updated password for user ID ${user.id}: ${user.username}`);
      } catch (error) {
        console.error(`Error updating user ${user.id}:`, error.message);
      }
    }
    
    console.log(`Completed range ${startId}-${endId}`);
    return users.length;
  } catch (error) {
    console.error('Error processing range:', error);
    return 0;
  }
}

// Main function
async function main() {
  try {
    // Process remaining users in very small ranges to avoid timeouts
    const ranges = [
      { start: 201, end: 225 },
      { start: 226, end: 250 },
      { start: 251, end: 275 },
      { start: 276, end: 300 },
      { start: 301, end: 325 },
      { start: 326, end: 350 },
      { start: 351, end: 375 },
      { start: 376, end: 400 },
      { start: 401, end: 425 },
      { start: 426, end: 450 }
    ];
    
    let totalProcessed = 0;
    
    for (const range of ranges) {
      const processed = await updateSpecificRange(range.start, range.end);
      totalProcessed += processed;
      
      console.log(`Processed ${totalProcessed} users so far`);
    }
    
    console.log(`Completed all ranges. Total users processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Main process error:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Execute the main function
main();