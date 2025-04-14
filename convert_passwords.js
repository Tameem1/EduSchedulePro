// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { scrypt, randomBytes } from 'crypto';
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

// Hash password function (using scrypt as in auth.ts)
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Read the original passwords from JSON file
async function loadPasswordsFromJson() {
  try {
    console.log('Reading students.json file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create a map of user ID to secret_code (original password)
    const secretCodeMap = new Map();
    jsonData.forEach(user => {
      secretCodeMap.set(user.id, user.secret_code);
    });
    
    console.log(`Loaded ${secretCodeMap.size} user passwords from JSON file.`);
    return secretCodeMap;
  } catch (error) {
    console.error('Error loading passwords from JSON:', error);
    throw error;
  }
}

// Update all bcrypt passwords to scrypt format
async function convertBcryptToScrypt() {
  let client;
  try {
    // Get original passwords from JSON
    const secretCodeMap = await loadPasswordsFromJson();
    
    // Find all users with bcrypt passwords
    client = await pool.connect();
    const { rows } = await client.query(`
      SELECT id, username, password, role, section 
      FROM users 
      WHERE password LIKE '$2b$10%'
      ORDER BY id
    `);
    
    console.log(`Found ${rows.length} users with bcrypt passwords to convert.`);
    
    // Update each user
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const user of rows) {
      try {
        // Get original password from JSON map
        const originalPassword = secretCodeMap.get(user.id);
        
        if (!originalPassword) {
          console.log(`⚠️  No original password found for user ID ${user.id} (${user.username}). Skipping.`);
          errorCount++;
          continue;
        }
        
        // Hash with scrypt format (same as auth.ts)
        const newHash = await hashPassword(originalPassword);
        
        // Update in database
        await client.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [newHash, user.id]
        );
        
        console.log(`✅ Updated user ${user.id} (${user.username}) - ${user.role} in ${user.section}`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating user ${user.id} (${user.username}):`, error);
        errorCount++;
      }
    }
    
    console.log('\nPassword conversion summary:');
    console.log(`Total bcrypt passwords found: ${rows.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Failed updates: ${errorCount}`);
    
    // Verify updated passwords
    const { rows: remainingBcrypt } = await client.query(
      "SELECT COUNT(*) FROM users WHERE password LIKE '$2b$10%'"
    );
    
    console.log(`Remaining bcrypt passwords: ${remainingBcrypt[0].count}`);
    
    if (remainingBcrypt[0].count === '0') {
      console.log('🎉 SUCCESS: All passwords successfully converted to scrypt format!');
    } else {
      console.log('⚠️  WARNING: Some passwords still remain in bcrypt format.');
    }
    
  } catch (error) {
    console.error('Error during password conversion:', error);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('\nPassword conversion process completed.');
  }
}

// Run the conversion
convertBcryptToScrypt().catch(error => {
  console.error('Fatal error in conversion process:', error);
  process.exit(1);
});