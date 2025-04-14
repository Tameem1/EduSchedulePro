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

// Compare passwords function that handles multiple formats
async function comparePasswords(supplied, stored) {
  try {
    // Check if it's a bcrypt hash
    if (stored.startsWith('$2')) {
      return await bcrypt.compare(supplied, stored);
    }
    // Check if it's a scrypt hash (with salt)
    else if (stored.includes('.')) {
      try {
        const [hashed, salt] = stored.split(".");
        const hashedBuf = Buffer.from(hashed, "hex");
        const suppliedBuf = await scryptAsync(supplied, salt, 64);
        return timingSafeEqual(hashedBuf, suppliedBuf);
      } catch (error) {
        console.log(`Scrypt comparison error: ${error.message}`);
        return false;
      }
    } else {
      // Unknown format
      console.log(`Unknown password format: ${stored.substring(0, 10)}...`);
      return false;
    }
  } catch (error) {
    console.log(`Password comparison error: ${error.message}`);
    return false;
  }
}

// Verify auth with original passwords
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
    
    // Test a good sample of users with different hash formats
    const sampleQuery = `
      (SELECT id, username, password, role, section FROM users WHERE password LIKE '%.%' ORDER BY RANDOM() LIMIT 5)
      UNION
      (SELECT id, username, password, role, section FROM users WHERE password LIKE '$2%' ORDER BY RANDOM() LIMIT 5)
      ORDER BY id
    `;
    
    const sampleUsers = await pool.query(sampleQuery);
    console.log(`Testing ${sampleUsers.rows.length} random users with different password formats...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const user of sampleUsers.rows) {
      const originalPassword = secretCodeMap.get(user.id);
      
      if (!originalPassword) {
        console.log(`❌ No original password found for user ID ${user.id} (${user.username}). Skipping.`);
        failCount++;
        continue;
      }
      
      // Try to authenticate with original password
      const passwordMatches = await comparePasswords(originalPassword, user.password);
      
      if (passwordMatches) {
        console.log(`✅ PASS: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Hash format: ${user.password.startsWith('$2') ? 'bcrypt' : 'scrypt'}`);
        successCount++;
      } else {
        console.log(`❌ FAIL: User ${user.id} (${user.username}) - ${user.role} in ${user.section} - Hash format: ${user.password.startsWith('$2') ? 'bcrypt' : 'scrypt'}`);
        // Print first few chars of password and hash
        console.log(`   Original password: ${originalPassword}`);
        console.log(`   Stored hash: ${user.password.substring(0, 20)}...`);
        failCount++;
      }
    }
    
    console.log('\nAuthentication test summary:');
    console.log(`Total users tested: ${sampleUsers.rows.length}`);
    console.log(`Successful authentications: ${successCount}`);
    console.log(`Failed authentications: ${failCount}`);
    
    const successRate = (successCount / sampleUsers.rows.length) * 100;
    console.log(`Success rate: ${successRate.toFixed(2)}%`);
    
  } catch (error) {
    console.error('Error during auth verification:', error);
  } finally {
    await pool.end();
    console.log('\nAuth verification completed.');
  }
}

// Run the verification
verifyAuth().catch(error => {
  console.error('Error in auth verification process:', error);
  process.exit(1);
});