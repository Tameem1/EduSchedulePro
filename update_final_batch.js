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
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Function to update a specific range of user IDs
async function updateUserPassword(userId, secretCodeMap) {
  try {
    // Get the original password from JSON map
    const originalPassword = secretCodeMap.get(userId);
    
    if (!originalPassword) {
      console.log(`No original password found for user ID ${userId}. Skipping.`);
      return false;
    }
    
    // Hash the password using the auth.ts method
    const hashedPassword = await hashPassword(originalPassword);
    
    // Update the user's password in the database
    const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2 RETURNING username';
    const updateResult = await pool.query(updateQuery, [hashedPassword, userId]);
    
    if (updateResult.rows.length > 0) {
      console.log(`Updated password for user ID ${userId}: ${updateResult.rows[0].username}`);
      return true;
    } else {
      console.log(`No user found with ID ${userId}. Skipping.`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating password for user ID ${userId}:`, error.message);
    return false;
  }
}

// Find users that still need password updates
async function findUsersNeedingUpdate() {
  try {
    // Get all users with incorrect password format
    const query = `
      SELECT id, username, section, role
      FROM users
      WHERE password NOT LIKE '%.%'
      ORDER BY id
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error finding users needing update:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting final password update process...');
    
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Find users with incorrect password format
    const usersToUpdate = await findUsersNeedingUpdate();
    console.log(`Found ${usersToUpdate.length} users with incorrect password format.`);
    
    if (usersToUpdate.length === 0) {
      console.log('No users found that need password updates. All passwords are up to date!');
      return;
    }
    
    // Begin a transaction
    await pool.query('BEGIN');
    
    let successCount = 0;
    let failCount = 0;
    
    // Update each user's password
    for (const user of usersToUpdate) {
      const success = await updateUserPassword(user.id, secretCodeMap);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('\nFinal password update summary:');
    console.log(`Total users processed: ${usersToUpdate.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to update: ${failCount}`);
    
    // Verify final result
    const verifyQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(CASE WHEN password LIKE '%.%' THEN 1 END) as hashed_passwords,
             COUNT(CASE WHEN password NOT LIKE '%.%' THEN 1 END) as unhashed_passwords
      FROM users
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const { total_users, hashed_passwords, unhashed_passwords } = verifyResult.rows[0];
    
    console.log('\nFinal password verification:');
    console.log(`Total users: ${total_users}`);
    console.log(`Users with properly hashed passwords: ${hashed_passwords}`);
    console.log(`Users with incorrectly hashed passwords: ${unhashed_passwords}`);
    
    if (total_users === hashed_passwords) {
      console.log('✅ SUCCESS: All user passwords have been updated to use the correct hashing format!');
    } else {
      console.log(`⚠️ WARNING: ${unhashed_passwords} users still don't have properly hashed passwords.`);
    }
    
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
    console.log('\nFinal password update completed.');
  }
}

// Run the password update
main().catch(error => {
  console.error('Error in password update process:', error);
  process.exit(1);
});