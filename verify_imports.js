// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Verify imports
async function verifyImports() {
  try {
    console.log('Starting import verification...');
    
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Count total users in JSON file
    console.log(`Total users in JSON file: ${jsonData.length}`);
    
    // Count total users in database
    const dbCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const dbCount = parseInt(dbCountResult.rows[0].count);
    console.log(`Total users in database: ${dbCount}`);
    
    // Get password format statistics
    const formatQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(CASE WHEN password LIKE '%.%' THEN 1 END) as hashed_passwords,
             COUNT(CASE WHEN password NOT LIKE '%.%' THEN 1 END) as unhashed_passwords
      FROM users
    `;
    
    const formatResult = await pool.query(formatQuery);
    const { total_users, hashed_passwords, unhashed_passwords } = formatResult.rows[0];
    
    console.log('\nPassword format:');
    console.log(`Total users: ${total_users}`);
    console.log(`Users with properly hashed passwords: ${hashed_passwords}`);
    console.log(`Users with incorrectly hashed passwords: ${unhashed_passwords}`);
    
    // Check for empty passwords
    const emptyQuery = `
      SELECT id, username, password, role, section
      FROM users
      WHERE password IS NULL OR password = ''
      ORDER BY id
    `;
    
    const emptyResult = await pool.query(emptyQuery);
    
    if (emptyResult.rows.length > 0) {
      console.log('\nUsers with empty passwords:');
      emptyResult.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Section: ${user.section}, Role: ${user.role}`);
      });
    } else {
      console.log('\nNo users with empty passwords found.');
    }
    
    // Check users with weird passwords
    const badHashQuery = `
      SELECT id, username, password, role, section
      FROM users
      WHERE password LIKE '%.%' AND LENGTH(password) < 100
      ORDER BY id
      LIMIT 5
    `;
    
    const badHashResult = await pool.query(badHashQuery);
    
    if (badHashResult.rows.length > 0) {
      console.log('\nUsers with potentially malformed hashed passwords:');
      badHashResult.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Hash Length: ${user.password.length}, Password: ${user.password.substring(0, 20)}...`);
      });
    }
    
    // Check for duplicate users in database
    const duplicateQuery = `
      SELECT username, section, COUNT(*) as count
      FROM users
      GROUP BY username, section
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    const duplicateResult = await pool.query(duplicateQuery);
    
    if (duplicateResult.rows.length > 0) {
      console.log('\nDuplicate username/section combinations:');
      duplicateResult.rows.forEach(row => {
        console.log(`Username: ${row.username}, Section: ${row.section}, Count: ${row.count}`);
      });
    } else {
      console.log('\nNo duplicate username/section combinations found.');
    }
    
    // Check for users in the JSON file that are missing from database
    console.log('\nChecking for missing users...');
    
    // Create ID set from database
    const dbIdsResult = await pool.query('SELECT id FROM users');
    const dbIds = new Set(dbIdsResult.rows.map(row => row.id));
    
    // Find missing users
    const missingUsers = jsonData.filter(user => !dbIds.has(user.id));
    
    if (missingUsers.length > 0) {
      console.log(`Found ${missingUsers.length} users in JSON file that are missing from database.`);
      console.log('First 5 missing users:');
      missingUsers.slice(0, 5).forEach(user => {
        console.log(`ID: ${user.id}, Name: ${user.name}, Group: ${user.group}`);
      });
    } else {
      console.log('No missing users found. All users from JSON file are in the database.');
    }
    
  } catch (error) {
    console.error('Error during import verification:', error);
  } finally {
    await pool.end();
    console.log('\nImport verification completed.');
  }
}

// Run the verification
verifyImports().catch(error => {
  console.error('Error in verification process:', error);
  process.exit(1);
});