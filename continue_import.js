import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define teacher groups
const teacherGroups = ['aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia'];

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Hash password function
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Function to convert section name to valid section enum value
function mapSectionToEnum(sectionName) {
  // Check if section name matches one of our enum values
  const validSections = ['section1', 'section2', 'section3', 'section4', 'section5'];
  if (validSections.includes(sectionName)) {
    return sectionName;
  }
  
  // Otherwise map it to a default section based on some logic
  const sectionMap = {
    'aasem': 'section1',
    'khaled': 'section2',
    'mmdoh': 'section3',
    'obada': 'section4',
    'awab': 'section1',
    'zuhair': 'section5',
    'yahia': 'section3',
    'omar': 'section2',
    'motaa': 'section4',
    'mahmoud': 'section5'
  };
  
  return sectionMap[sectionName] || 'section1'; // Default to section1 if not found
}

// Function to find the highest ID in the database
async function getHighestUserId() {
  try {
    const result = await pool.query('SELECT MAX(id) FROM users');
    return result.rows[0].max || 0;
  } catch (error) {
    console.error('Error getting highest user ID:', error);
    return 0;
  }
}

// Continue importing users
async function continueImport() {
  try {
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${usersData.length} users in JSON file.`);
    
    // Get existing user IDs
    const existingUsersResult = await pool.query('SELECT id FROM users');
    const existingIds = new Set(existingUsersResult.rows.map(row => row.id));
    
    // Filter users that haven't been imported yet
    const usersToImport = usersData.filter(user => !existingIds.has(user.id));
    
    console.log(`Found ${usersToImport.length} users to import (${usersData.length - usersToImport.length} already exist).`);
    
    // Get existing usernames to avoid duplicates
    const existingUsernamesResult = await pool.query('SELECT username FROM users');
    const existingUsernames = new Set(existingUsernamesResult.rows.map(row => row.username));
    
    // Process and import each user
    let successCount = 0;
    let failCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    
    for (const user of usersToImport) {
      try {
        // Determine role based on group
        const role = teacherGroups.includes(user.group) ? 'teacher' : 'student';
        
        // Update counters
        if (role === 'teacher') {
          teacherCount++;
        } else {
          studentCount++;
        }
        
        // Map section
        const section = mapSectionToEnum(user.group);
        
        // Hash password
        const hashedPassword = await hashPassword(user.secret_code);
        
        // Check if username already exists
        let username = user.name;
        if (existingUsernames.has(username)) {
          // Create a unique username by appending the ID
          username = `${user.name}_${user.id}`;
          console.log(`Username ${user.name} already exists, using ${username} instead.`);
        }
        
        // Remember this username to avoid duplicates within this batch
        existingUsernames.add(username);
        
        // Insert user
        const query = `
          INSERT INTO users (id, username, password, role, section, telegram_username, telegram_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE
          SET username = $2, password = $3, role = $4, section = $5, telegram_username = $6, telegram_id = $7
          RETURNING id
        `;
        
        const values = [
          user.id,
          username,
          hashedPassword,
          role,
          section,
          null, // telegram_username is null initially
          null  // telegram_id is null initially
        ];
        
        const result = await pool.query(query, values);
        
        successCount++;
        console.log(`Registered user ID ${result.rows[0].id}: ${username} as ${role}`);
      } catch (error) {
        failCount++;
        console.error(`Error registering user ${user.name} (ID: ${user.id}):`, error.message);
      }
    }
    
    console.log('\nUser import summary:');
    console.log(`Users to import: ${usersToImport.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${failCount}`);
    console.log(`Teachers registered: ${teacherCount}`);
    console.log(`Students registered: ${studentCount}`);
    
    // Get final count of users in the database
    const finalCountResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\nTotal users in database: ${finalCountResult.rows[0].count}`);
    
    console.log('\nUser import completed!');
  } catch (error) {
    console.error('Unhandled error during user import:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the import
continueImport();