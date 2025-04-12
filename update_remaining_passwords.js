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

// Process users within ID range
async function updateUserPasswordsInRange(startId, endId) {
  try {
    console.log(`Starting password update for users with IDs from ${startId} to ${endId}...`);
    
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
    
    console.log(`Found ${users.length} users to update within ID range ${startId}-${endId}.`);
    
    // Update each user
    let successCount = 0;
    
    for (const user of users) {
      try {
        // Get the secret code for this user ID
        const secretCode = secretCodeMap[user.id] || user.id.toString();
        
        // Hash the password using the application's method
        const hashedPassword = await hashPassword(secretCode);
        
        const updateQuery = `
          UPDATE users
          SET password = $1
          WHERE id = $2
        `;
        
        await pool.query(updateQuery, [hashedPassword, user.id]);
        
        successCount++;
        console.log(`Updated password for user ID ${user.id}: ${user.username} (secret code: ${secretCode})`);
      } catch (error) {
        console.error(`Error updating password for user ${user.username} (ID: ${user.id}):`, error.message);
      }
    }
    
    console.log(`\nBatch completed: ${successCount}/${users.length} passwords updated successfully.`);
    
    return successCount;
  } catch (error) {
    console.error('Unhandled error during password update:', error);
    return 0;
  }
}

// Main function to process all users in smaller ranges
async function processAllUsers() {
  try {
    // Define ranges to process
    const ranges = [
      { start: 101, end: 150 },
      { start: 151, end: 200 },
      { start: 201, end: 250 },
      { start: 251, end: 300 },
      { start: 301, end: 350 },
      { start: 351, end: 400 },
      { start: 401, end: 450 }
    ];
    
    let totalUpdated = 0;
    
    for (const range of ranges) {
      const updated = await updateUserPasswordsInRange(range.start, range.end);
      totalUpdated += updated;
      console.log(`Completed range ${range.start}-${range.end}, total updated so far: ${totalUpdated}`);
    }
    
    console.log(`\nAll ranges processed. Total users updated: ${totalUpdated}`);
  } catch (error) {
    console.error('Error in processAllUsers:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the process
processAllUsers();