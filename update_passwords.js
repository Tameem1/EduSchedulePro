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

async function updateUserPasswords() {
  try {
    console.log('Starting password update for all users...');
    
    // Read the JSON file to get the secret codes
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user IDs to secret codes for quick lookup
    const secretCodeMap = {};
    studentsData.forEach(student => {
      secretCodeMap[student.id] = student.secret_code;
    });
    
    // Get all users
    const result = await pool.query('SELECT id, username FROM users');
    const users = result.rows;
    
    console.log(`Found ${users.length} users to update with correct passwords.`);
    
    // Process users in batches to avoid timeouts
    const batchSize = 50;
    const totalBatches = Math.ceil(users.length / batchSize);
    
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * batchSize;
      const end = Math.min(start + batchSize, users.length);
      const batchUsers = users.slice(start, end);
      
      console.log(`Processing batch ${batchNum + 1}/${totalBatches} (users ${start + 1}-${end})`);
      
      // Update each user in the batch
      let batchSuccessCount = 0;
      
      for (const user of batchUsers) {
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
          
          batchSuccessCount++;
          console.log(`Updated password for user ID ${user.id}: ${user.username} (secret code: ${secretCode})`);
        } catch (error) {
          console.error(`Error updating password for user ${user.username} (ID: ${user.id}):`, error.message);
        }
      }
      
      console.log(`Batch ${batchNum + 1} completed: ${batchSuccessCount}/${batchUsers.length} passwords updated successfully.`);
    }
    
    console.log('\nPassword update completed!');
  } catch (error) {
    console.error('Unhandled error during password update:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the password update
updateUserPasswords();