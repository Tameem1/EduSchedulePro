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

// Same function as in auth.ts
const scryptAsync = promisify(crypto.scrypt);

async function comparePasswords(supplied, stored) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = await scryptAsync(supplied, salt, 64);
    return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error.message);
    return false;
  }
}

async function verifyAuth() {
  try {
    console.log('==========================================');
    console.log('VERIFYING USER PASSWORDS DIRECTLY IN DATABASE');
    console.log('==========================================');
    
    // Read the JSON file to get the original secret codes
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user IDs to secret codes for quick lookup
    const secretCodeMap = {};
    studentsData.forEach(student => {
      secretCodeMap[student.id] = student.secret_code;
    });
    
    // Get 25 random users
    const result = await pool.query(`
      SELECT id, username, password, role 
      FROM users 
      ORDER BY RANDOM() 
      LIMIT 25
    `);
    
    const users = result.rows;
    console.log(`Selected ${users.length} random users for verification`);
    
    let successCount = 0;
    
    // Test each user
    for (const user of users) {
      try {
        // Get the right password - either from secret_code or user ID
        const password = secretCodeMap[user.id] || user.id.toString();
        
        // Check password format
        const hasCorrectFormat = user.password.includes('.') && user.password.split('.').length === 2;
        
        if (hasCorrectFormat) {
          // Verify the password
          const isValid = await comparePasswords(password, user.password);
          if (isValid) {
            console.log(`✅ User ${user.username} (ID: ${user.id}, Role: ${user.role}) - Password verified`);
            successCount++;
          } else {
            console.log(`❌ User ${user.username} (ID: ${user.id}, Role: ${user.role}) - Password verification FAILED`);
          }
        } else {
          console.log(`⚠️ User ${user.username} (ID: ${user.id}, Role: ${user.role}) - Password format incorrect`);
        }
      } catch (error) {
        console.error(`❌ Error verifying user ${user.id}: ${error.message}`);
      }
    }
    
    console.log(`\nPassword verification results: ${successCount}/${users.length} successful verifications`);
    console.log('==========================================');
    
    // Get total user count by role
    const countResult = await pool.query(`
      SELECT role, COUNT(*) 
      FROM users 
      GROUP BY role
    `);
    
    console.log('\nUser distribution by role:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.role}: ${row.count} users`);
    });
    
    const totalUsers = countResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    console.log(`Total users in database: ${totalUsers}`);
    console.log('==========================================');
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyAuth();