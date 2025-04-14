// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Define teacher sections
const teacherSections = ['mmdoh', 'khaled', 'obada', 'awab', 'zuhair', 'yahia', 'kibar'];

// Function to hash password
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Function to import missing users
async function importMissingUsers() {
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
    
    // Filter the users that are not in the database
    const missingUsers = jsonData.filter(user => !dbIds.has(user.id));
    
    console.log(`Found ${missingUsers.length} users missing from database.`);
    
    if (missingUsers.length === 0) {
      console.log('No missing users to import.');
      return;
    }
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // Process each missing user
    let successCount = 0;
    let failCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    
    for (const user of missingUsers) {
      try {
        // Determine role based on section
        const section = user.group; // Map group to section
        const role = teacherSections.includes(section) ? 'teacher' : 'student';
        
        // Update counters
        if (role === 'teacher') {
          teacherCount++;
        } else {
          studentCount++;
        }
        
        // Hash password (secret_code)
        const hashedPassword = await hashPassword(user.secret_code);
        
        // Make username unique by appending random suffix to handle duplicates
        let username = user.name;
        if (username.includes('// معطل') || user.id === 409) {
          // For disabled accounts or known duplicates, append the ID to make them unique
          username = `${username}_${user.id}`;
        }
        
        // Insert user with mapped fields
        const query = `
          INSERT INTO users (id, username, password, role, section, telegram_username)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE
          SET username = $2, password = $3, role = $4, section = $5, telegram_username = $6
          RETURNING id
        `;
        
        const values = [
          user.id,
          username,                // Map name to username (potentially modified)
          hashedPassword,          // Map hashed secret_code to password
          role,
          section,                 // Map group to section
          null                     // telegram_username is null initially
        ];
        
        const result = await pool.query(query, values);
        
        successCount++;
        console.log(`Registered user ID ${result.rows[0].id}: ${username} as ${role}`);
      } catch (error) {
        failCount++;
        console.error(`Error registering user ${user.name} (ID: ${user.id}):`, error.message);
      }
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('\nMissing user import summary:');
    console.log(`Missing users processed: ${missingUsers.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${failCount}`);
    console.log(`Additional teachers registered: ${teacherCount}`);
    console.log(`Additional students registered: ${studentCount}`);
    
    // Get final count of users in the database
    const finalCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    console.log(`\nTotal users in database: ${finalCount}`);
    console.log(`Total unique users in JSON: ${jsonData.length}`);
    
  } catch (error) {
    // Rollback transaction in case of error
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Unhandled error during user import:', error);
  } finally {
    await pool.end();
    console.log('\nMissing user import completed.');
  }
}

// Run the import
importMissingUsers().catch(error => {
  console.error('Error in missing user import process:', error);
  process.exit(1);
});