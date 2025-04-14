// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import bcrypt from 'bcrypt';

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

// Compare passwords function (supports both bcrypt and scrypt)
async function comparePasswords(supplied, stored) {
  try {
    // Check if it's a bcrypt hash
    if (stored.startsWith('$2')) {
      return await bcrypt.compare(supplied, stored);
    } 
    // Check if it's a scrypt hash (with salt)
    else if (stored.includes('.')) {
      const [hashed, salt] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = await scryptAsync(supplied, salt, 64);
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } else {
      console.log(`Unknown password format: ${stored.substring(0, 10)}...`);
      return false;
    }
  } catch (error) {
    console.log(`Password comparison error: ${error.message}`);
    return false;
  }
}

// Test logins
async function testLogins() {
  try {
    console.log('Starting login tests with multi-format support...');
    
    // Read users from JSON file to get original passwords
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    // Get test users specifically including the ones mentioned
    const testUsers = await pool.query(`
      SELECT id, username, password, role, section 
      FROM users 
      WHERE username IN ('محمد خير', 'معاذ ش', 'عمر ع', 'ابي')
      OR id IN (SELECT id FROM users WHERE password LIKE '%.%' ORDER BY RANDOM() LIMIT 3)
      ORDER BY id
    `);
    
    console.log(`Testing ${testUsers.rows.length} users with different password formats...`);
    
    // Test each user
    let bcryptSuccess = 0;
    let bcryptFail = 0;
    let scryptSuccess = 0;
    let scryptFail = 0;
    
    for (const user of testUsers.rows) {
      const originalPassword = secretCodeMap.get(user.id);
      
      if (!originalPassword) {
        console.log(`❌ No original password found for user ID ${user.id} (${user.username}). Skipping.`);
        continue;
      }
      
      const isBcrypt = user.password.startsWith('$2');
      const passwordMatches = await comparePasswords(originalPassword, user.password);
      
      if (passwordMatches) {
        console.log(`✅ PASS: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Hash format: ${isBcrypt ? 'bcrypt' : 'scrypt'}`);
        if (isBcrypt) bcryptSuccess++;
        else scryptSuccess++;
      } else {
        console.log(`❌ FAIL: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Hash format: ${isBcrypt ? 'bcrypt' : 'scrypt'}`);
        console.log(`   Password: ${originalPassword}`);
        console.log(`   Hash: ${user.password.substring(0, 20)}...`);
        if (isBcrypt) bcryptFail++;
        else scryptFail++;
      }
    }
    
    console.log('\nLogin test summary:');
    console.log(`Bcrypt passwords: ${bcryptSuccess} successful, ${bcryptFail} failed`);
    console.log(`Scrypt passwords: ${scryptSuccess} successful, ${scryptFail} failed`);
    console.log(`Total success rate: ${((bcryptSuccess + scryptSuccess) / testUsers.rows.length * 100).toFixed(2)}%`);
    
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