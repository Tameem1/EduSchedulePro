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

// Function to check which users need password updates
async function findUsersNeedingUpdate() {
  try {
    console.log('Checking which users need password updates...');
    
    // Look for users with incorrect password format
    // Specifically look for bcrypt passwords (they start with $2b$)
    // Also check for passwords missing the hash.salt pattern
    const result = await pool.query(`
      SELECT id, username, password 
      FROM users 
      WHERE password LIKE '$2b$%' 
         OR password NOT LIKE '%.%' 
         OR LENGTH(password) < 50
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('No users found with incorrect password format!');
      return [];
    }
    
    console.log(`Found ${result.rows.length} users with incorrect password format.`);
    return result.rows.map(user => user.id);
  } catch (error) {
    console.error('Error checking users:', error);
    return [];
  }
}

// Function to update a single user's password
async function updateUserPassword(userId, secretCodeMap) {
  try {
    // Get user info
    const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      console.log(`No user found with ID ${userId}`);
      return false;
    }
    
    const user = userResult.rows[0];
    
    // Get secret code from the map
    const secretCode = secretCodeMap[userId] || userId.toString();
    
    // Generate hashed password
    const hashedPassword = await hashPassword(secretCode);
    
    // Update the user
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    
    console.log(`Updated password for user ID ${userId}: ${user.username}`);
    return true;
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    return false;
  }
}

// Function to update all remaining users with incorrect passwords
async function updateRemainingUsers() {
  try {
    console.log('Starting final password update...');
    
    // Read the JSON file to get secret codes
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create secret code map
    const secretCodeMap = {};
    studentsData.forEach(student => {
      secretCodeMap[student.id] = student.secret_code;
    });
    
    // Get a list of users that need updates
    const userIds = await findUsersNeedingUpdate();
    
    if (userIds.length === 0) {
      console.log('All user passwords appear to be properly formatted. No updates needed.');
      return;
    }
    
    // Update each user
    let successCount = 0;
    
    for (const userId of userIds) {
      const updated = await updateUserPassword(userId, secretCodeMap);
      if (updated) successCount++;
    }
    
    console.log(`Updated ${successCount}/${userIds.length} users`);
    console.log('Final password update completed!');
  } catch (error) {
    console.error('Error in updateRemainingUsers:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the update
updateRemainingUsers();