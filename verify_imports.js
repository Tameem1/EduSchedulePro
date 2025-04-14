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

async function verifyImports() {
  try {
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${jsonData.length} users in JSON file.`);
    
    // Get user IDs from database
    const dbResult = await pool.query('SELECT id FROM users');
    const dbIds = new Set(dbResult.rows.map(row => row.id));
    
    console.log(`Found ${dbIds.size} users in database.`);
    
    // Check which users from JSON are not in the database
    const missingUsers = jsonData.filter(user => !dbIds.has(user.id));
    
    console.log(`\nFound ${missingUsers.length} users missing from database.`);
    
    if (missingUsers.length > 0) {
      console.log('\nMissing users (first 20 shown):');
      missingUsers.slice(0, 20).forEach(user => {
        console.log(`ID: ${user.id}, Name: ${user.name}, Group: ${user.group}, Secret Code: ${user.secret_code}`);
      });
    }
    
    // Check for duplicate usernames within the same section in JSON
    const nameToSectionMap = new Map();
    const potentialDuplicates = [];
    
    for (const user of jsonData) {
      const key = `${user.name}_${user.group}`;
      if (nameToSectionMap.has(key)) {
        potentialDuplicates.push({
          existingUser: nameToSectionMap.get(key),
          duplicateUser: user
        });
      } else {
        nameToSectionMap.set(key, user);
      }
    }
    
    console.log(`\nFound ${potentialDuplicates.length} potential duplicates in JSON file.`);
    
    if (potentialDuplicates.length > 0) {
      console.log('\nPotential duplicates (first 20 shown):');
      potentialDuplicates.slice(0, 20).forEach(item => {
        console.log(`\nExisting: ID: ${item.existingUser.id}, Name: ${item.existingUser.name}, Group: ${item.existingUser.group}`);
        console.log(`Duplicate: ID: ${item.duplicateUser.id}, Name: ${item.duplicateUser.name}, Group: ${item.duplicateUser.group}`);
      });
    }
    
  } catch (error) {
    console.error('Error verifying imports:', error);
  } finally {
    await pool.end();
    console.log('\nVerification completed.');
  }
}

// Run the verification
verifyImports().catch(error => {
  console.error('Error in verification process:', error);
  process.exit(1);
});