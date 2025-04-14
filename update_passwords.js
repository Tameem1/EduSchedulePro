// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Promisify scrypt
const scryptAsync = promisify(scrypt);

// Password hashing function (copied from auth.ts)
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

// Function to update user passwords in a specific range
async function updateUserPasswords() {
  try {
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const userPasswordMap = new Map();
    jsonData.forEach(user => {
      userPasswordMap.set(user.id, user.secret_code);
    });
    
    console.log(`Found ${jsonData.length} users in JSON file.`);
    
    // Set the range of user IDs to update (1-100)
    const startId = 1;
    const endId = 100;
    
    // Get users in the range from the database
    const dbResult = await pool.query('SELECT id, username FROM users WHERE id >= $1 AND id <= $2 ORDER BY id', [startId, endId]);
    console.log(`Found ${dbResult.rows.length} users in database in range ${startId}-${endId}.`);
    
    // Begin a transaction
    await pool.query('BEGIN');
    
    let successCount = 0;
    let failCount = 0;
    
    // Update each user's password
    for (const user of dbResult.rows) {
      try {
        // Get the original password from the JSON data
        const originalPassword = userPasswordMap.get(user.id);
        
        if (!originalPassword) {
          console.log(`No original password found for user ID ${user.id} (${user.username}). Skipping.`);
          continue;
        }
        
        // Hash the password using the auth.ts method
        const hashedPassword = await hashPassword(originalPassword);
        
        // Update the user's password in the database
        const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2';
        await pool.query(updateQuery, [hashedPassword, user.id]);
        
        successCount++;
        console.log(`Updated password for user ID ${user.id}: ${user.username}`);
      } catch (error) {
        failCount++;
        console.error(`Error updating password for user ${user.username} (ID: ${user.id}):`, error.message);
      }
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('\nPassword update summary for range ' + startId + '-' + endId + ':');
    console.log(`Total users processed: ${dbResult.rows.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to update: ${failCount}`);
    
  } catch (error) {
    // Rollback transaction in case of error
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Unhandled error during password update:', error);
  } finally {
    await pool.end();
    console.log('\nPassword update completed for range 1-100.');
  }
}

// Run the password update
updateUserPasswords().catch(error => {
  console.error('Error in password update process:', error);
  process.exit(1);
});