import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Same function as in auth.ts
const scryptAsync = promisify(crypto.scrypt);

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
}

async function checkPasswords() {
  try {
    console.log('Checking password format for sample users...');
    
    // Get a sample of users (different sample each time)
    const result = await pool.query('SELECT id, username, password FROM users ORDER BY RANDOM() LIMIT 10');
    const users = result.rows;
    
    let correctFormatCount = 0;
    
    // Check each user's password format
    for (const user of users) {
      // Check if password follows the expected format (hash.salt)
      const hasSaltFormat = user.password.includes('.') && user.password.split('.').length === 2;
      
      console.log(`User ID ${user.id}: ${user.username}`);
      console.log(`  Password format is correct: ${hasSaltFormat}`);
      
      if (hasSaltFormat) {
        correctFormatCount++;
        // Try to verify using password = user ID (for users without corresponding JSON entry)
        try {
          const testPassword = user.id.toString();
          const verifies = await comparePasswords(testPassword, user.password);
          console.log(`  Test verification with ID as password: ${verifies}`);
        } catch (err) {
          console.log(`  Error in verification: ${err.message}`);
        }
      }
      
      console.log(`  Password sample: ${user.password.substring(0, 20)}...`);
      console.log('');
    }
    
    console.log(`Password format check results: ${correctFormatCount}/${users.length} correct`);
    
    // Check total user count
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`Total users in database: ${countResult.rows[0].count}`);
    
    console.log('Password check completed!');
  } catch (error) {
    console.error('Error during password check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPasswords();