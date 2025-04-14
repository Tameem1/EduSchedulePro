// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { scrypt, timingSafeEqual } from 'crypto';
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

// Compare passwords function
async function comparePasswords(supplied, stored) {
  try {
    if (stored && stored.includes('.')) {
      const [hashed, salt] = stored.split(".");
      
      if (!hashed || !salt) {
        return false;
      }
      
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = await scryptAsync(supplied, salt, 64);
      
      // Ensure both buffers are the same length before comparing
      if (hashedBuf.length !== suppliedBuf.length) {
        console.log(`Buffer length mismatch: ${hashedBuf.length} vs ${suppliedBuf.length}`);
        return false;
      }
      
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } else {
      // Old format or invalid format
      return false;
    }
  } catch (error) {
    // Safely handle any errors during comparison
    console.log(`Password comparison error for "${supplied.substring(0, 3)}...": ${error.message}`);
    return false;
  }
}

// Test logins using the JSON data
async function testLogins() {
  try {
    console.log('Starting login tests...');
    
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Get a test sample with different roles
    const testUsersQuery = `
      (SELECT id, username, password, role, section FROM users WHERE role = 'student' ORDER BY RANDOM() LIMIT 5)
      UNION
      (SELECT id, username, password, role, section FROM users WHERE role = 'teacher' ORDER BY RANDOM() LIMIT 5)
      ORDER BY id
    `;
    
    const testUsers = await pool.query(testUsersQuery);
    console.log(`Testing ${testUsers.rows.length} random users (students and teachers)...`);
    
    // Test each user
    let successCount = 0;
    let failCount = 0;
    
    for (const user of testUsers.rows) {
      const originalPassword = secretCodeMap.get(user.id);
      
      if (!originalPassword) {
        console.log(`❌ No original password found for user ID ${user.id} (${user.username}). Skipping.`);
        failCount++;
        continue;
      }
      
      const passwordMatches = await comparePasswords(originalPassword, user.password);
      
      if (passwordMatches) {
        console.log(`✅ PASS: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Login successful with original password`);
        successCount++;
      } else {
        console.log(`❌ FAIL: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Unable to authenticate`);
        failCount++;
      }
    }
    
    console.log('\nLogin test summary:');
    console.log(`Total users tested: ${testUsers.rows.length}`);
    console.log(`Successful logins: ${successCount}`);
    console.log(`Failed logins: ${failCount}`);
    
    const successRate = (successCount / testUsers.rows.length) * 100;
    console.log(`Success rate: ${successRate.toFixed(2)}%`);
    
    if (successRate === 100) {
      console.log('\n✅ SUCCESS: All tested users can login successfully with their original passwords!');
    } else {
      console.log('\n⚠️ WARNING: Some user logins are failing. Authentication system may need further review.');
    }
    
  } catch (error) {
    console.error('Error during login tests:', error);
  } finally {
    await pool.end();
    console.log('\nLogin tests completed.');
  }
}

// Run the tests
testLogins().catch(error => {
  console.error('Error in login test process:', error);
  process.exit(1);
});