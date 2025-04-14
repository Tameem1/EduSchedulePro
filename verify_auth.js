// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
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

// Compare passwords function (directly copied from auth.ts)
async function comparePasswords(supplied, stored) {
  try {
    if (stored.includes('.')) {
      const [hashed, salt] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = await scryptAsync(supplied, salt, 64);
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } else {
      // Old format passwords
      return false;
    }
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

// Verify authentication and test logins
async function verifyAuth() {
  try {
    console.log('Starting auth verification...');
    
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Get password hash format stats
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
    
    // Test authentication with real credentials
    console.log('\nTesting authentication with real credentials from JSON file...');
    
    // Get a sample of users to test
    const sampleUsersQuery = `
      SELECT id, username, password
      FROM users
      WHERE password LIKE '%.%'
      ORDER BY RANDOM()
      LIMIT 5
    `;
    
    const sampleUsersResult = await pool.query(sampleUsersQuery);
    
    for (const user of sampleUsersResult.rows) {
      // Get the original password from JSON
      const originalPassword = secretCodeMap.get(user.id);
      
      if (originalPassword) {
        // Test if auth works with the original password
        const passwordMatches = await comparePasswords(originalPassword, user.password);
        
        console.log(`User ${user.id} (${user.username}) - Authentication test: ${passwordMatches ? '✅ WORKS' : '❌ FAILS'}`);
      } else {
        console.log(`User ${user.id} (${user.username}) - No original password found in JSON file`);
      }
    }
    
    console.log('\nAuthentication verification completed.');
  } catch (error) {
    console.error('Error during authentication verification:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyAuth().catch(error => {
  console.error('Error in auth verification process:', error);
  process.exit(1);
});