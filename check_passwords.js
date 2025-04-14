// Import required modules
import pg from 'pg';
import { createHash } from 'crypto';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Promisify scrypt
const scryptAsync = promisify(scrypt);

// Compare password function (copied from auth.ts)
async function comparePasswords(supplied, stored) {
  try {
    // Check if the format is scrypt style (has a dot separator for salt)
    if (stored.includes('.')) {
      const [hashed, salt] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64));
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } else {
      // Old format - might not have proper hashing
      return false;
    }
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

// Check all passwords
async function checkPasswords() {
  try {
    console.log('Starting password verification...');
    
    // Get stats on total users and password format
    const verifyQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(CASE WHEN password LIKE '%.%' THEN 1 END) as hashed_passwords,
             COUNT(CASE WHEN password NOT LIKE '%.%' THEN 1 END) as unhashed_passwords
      FROM users
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const { total_users, hashed_passwords, unhashed_passwords } = verifyResult.rows[0];
    
    console.log('\nPassword hashing verification:');
    console.log(`Total users: ${total_users}`);
    console.log(`Users with properly hashed passwords: ${hashed_passwords}`);
    console.log(`Users with incorrectly hashed passwords: ${unhashed_passwords}`);
    
    if (total_users === hashed_passwords) {
      console.log('✅ SUCCESS: All user passwords have been updated to use the correct hashing format!');
    } else {
      console.log(`⚠️ WARNING: ${unhashed_passwords} users still don't have properly hashed passwords.`);
      
      // Display information about users with unhashed passwords
      const unhashed = await pool.query(`
        SELECT id, username, section, role
        FROM users
        WHERE password NOT LIKE '%.%'
        ORDER BY id
        LIMIT 10
      `);
      
      console.log('\nSample of users with unhashed passwords:');
      unhashed.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Section: ${user.section}, Role: ${user.role}`);
      });
    }
    
    // Test a few logins
    console.log('\nTesting login functionality with hashed passwords...');
    
    // Get a few hashed password users to test
    const sampleUsers = await pool.query(`
      SELECT id, username, password
      FROM users
      WHERE password LIKE '%.%'
      ORDER BY id
      LIMIT 5
    `);
    
    if (sampleUsers.rows.length > 0) {
      for (const user of sampleUsers.rows) {
        // For testing, we'll assume original password from username
        // This is just a simple test - in a real environment, we'd have test credentials
        const testPassword = user.username;
        
        // Test if the password verification works
        const passwordMatches = await comparePasswords(testPassword, user.password);
        
        console.log(`User ${user.id} (${user.username}) - Password verification: ${passwordMatches ? '✅ WORKS' : '❌ FAILS'}`);
      }
    }
    
    console.log('\nPassword verification completed.');
  } catch (error) {
    console.error('Error during password verification:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
checkPasswords().catch(error => {
  console.error('Error in password verification process:', error);
  process.exit(1);
});