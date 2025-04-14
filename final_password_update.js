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

// Find all users that still need password updates
async function findUsersNeedingUpdate() {
  try {
    // Read users from JSON file
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Get all user IDs that we already updated in previous batches
    // We've processed batches 1-100, 101-200, and 201-250 already
    const processedRanges = [
      { min: 1, max: 100 },
      { min: 101, max: 200 },
      { min: 201, max: 250 }
    ];
    
    let processedCondition = '';
    if (processedRanges.length > 0) {
      const conditions = processedRanges.map(range => 
        `(id >= ${range.min} AND id <= ${range.max})`
      );
      processedCondition = `AND NOT (${conditions.join(' OR ')})`;
    }
    
    // Get all remaining users that haven't been processed yet
    const query = `
      SELECT id, username 
      FROM users 
      WHERE id <= 450 ${processedCondition}
      ORDER BY id
    `;
    
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} users that still need password updates.`);
    
    return { users: result.rows, secretCodeMap };
  } catch (error) {
    console.error('Error finding users needing update:', error);
    throw error;
  }
}

// Update password for a single user
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

// Update remaining users
async function updateRemainingUsers() {
  try {
    console.log('Starting final password update process...');
    
    // Find users needing update and get their original passwords
    const { users, secretCodeMap } = await findUsersNeedingUpdate();
    
    if (users.length === 0) {
      console.log('No users found that need password updates. All passwords are up to date!');
      return;
    }
    
    // Begin a transaction
    await pool.query('BEGIN');
    
    // Process users in smaller batches to avoid timeouts
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(users.length / BATCH_SIZE);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, users.length);
      const batchUsers = users.slice(start, end);
      
      console.log(`\nProcessing batch ${batchNum + 1}/${totalBatches} (users ${start + 1}-${end})...`);
      
      // Update each user's password in this batch
      for (const user of batchUsers) {
        const success = await updateUserPassword(user.id, secretCodeMap);
        
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Commit after each batch
      await pool.query('COMMIT');
      
      // Start a new transaction for the next batch
      if (batchNum < totalBatches - 1) {
        await pool.query('BEGIN');
      }
      
      console.log(`Batch ${batchNum + 1} completed and committed.`);
    }
    
    console.log('\nFinal password update summary:');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to update: ${failCount}`);
    
    // Verify that all users have properly hashed passwords
    const verifyQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(CASE WHEN password LIKE '%.%' THEN 1 END) as hashed_passwords
      FROM users
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const { total_users, hashed_passwords } = verifyResult.rows[0];
    
    console.log('\nPassword verification:');
    console.log(`Total users: ${total_users}`);
    console.log(`Users with properly hashed passwords: ${hashed_passwords}`);
    
    if (total_users === hashed_passwords) {
      console.log('SUCCESS: All user passwords have been updated to use the correct hashing format!');
    } else {
      console.log(`WARNING: ${total_users - hashed_passwords} users still don't have properly hashed passwords.`);
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
updateRemainingUsers().catch(error => {
  console.error('Error in password update process:', error);
  process.exit(1);
});