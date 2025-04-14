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

// Compare passwords function (only scrypt format)
async function comparePasswords(supplied, stored) {
  try {
    // Check format
    if (!stored.includes('.')) {
      console.log(`Invalid password format: ${stored.substring(0, 10)}...`);
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = await scryptAsync(supplied, salt, 64);
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.log(`Password comparison error: ${error.message}`);
    return false;
  }
}

// Verify logins
async function verifyLogins() {
  try {
    console.log('Starting login verification after conversion...');
    
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Get previously problematic users plus a random sample of other users
    const testUsers = await pool.query(`
      SELECT id, username, password, role, section 
      FROM users 
      WHERE username IN ('محمد خير', 'معاذ ش', 'عمر ع', 'ابي', 'فؤاد', 'تميم', 'ذهبي', 'بلال')
      OR id IN (SELECT id FROM users ORDER BY RANDOM() LIMIT 10)
      ORDER BY id
    `);
    
    console.log(`Verifying ${testUsers.rows.length} users can login with original passwords...`);
    
    // Test each user
    let success = 0;
    let fail = 0;
    
    for (const user of testUsers.rows) {
      const originalPassword = secretCodeMap.get(user.id);
      
      if (!originalPassword) {
        console.log(`❌ No original password found for user ID ${user.id} (${user.username}). Skipping.`);
        continue;
      }
      
      // Confirm all passwords are now in scrypt format
      if (!user.password.includes('.')) {
        console.log(`❌ User ${user.id} (${user.username}) still has non-scrypt password: ${user.password.substring(0, 10)}...`);
        fail++;
        continue;
      }
      
      const passwordMatches = await comparePasswords(originalPassword, user.password);
      
      if (passwordMatches) {
        console.log(`✅ PASS: User ${user.id} (${user.username}) - ${user.role} in ${user.section}`);
        success++;
      } else {
        console.log(`❌ FAIL: User ${user.id} (${user.username}) - ${user.role} in ${user.section}`);
        console.log(`   Password: ${originalPassword}`);
        console.log(`   Hash: ${user.password.substring(0, 20)}...`);
        fail++;
      }
    }
    
    console.log('\nLogin verification summary:');
    console.log(`Successfully authenticated: ${success}`);
    console.log(`Failed authentication: ${fail}`);
    console.log(`Success rate: ${((success / (success + fail)) * 100).toFixed(2)}%`);
    
    // Final verification - check if ANY bcrypt passwords remain
    const { rows: remainingBcrypt } = await pool.query(
      "SELECT COUNT(*) FROM users WHERE password NOT LIKE '%.%'"
    );
    
    console.log(`\nUsers without scrypt password format: ${remainingBcrypt[0].count}`);
    
    if (remainingBcrypt[0].count === '0') {
      console.log('🎉 SUCCESS: All users have scrypt format passwords!');
    } else {
      console.log('⚠️ WARNING: Some users still have non-scrypt passwords.');
    }
    
  } catch (error) {
    console.error('Error during login verification:', error);
  } finally {
    await pool.end();
    console.log('\nVerification completed.');
  }
}

// Run the verification
verifyLogins().catch(error => {
  console.error('Error in verification process:', error);
  process.exit(1);
});