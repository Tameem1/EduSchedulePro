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

// Create backup directory
async function createBackup() {
  try {
    console.log('Creating database backup before proceeding...');
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get current timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    // Tables to backup
    const tables = [
      'questionnaire_responses', 
      'independent_assignments', 
      'appointments', 
      'availabilities', 
      'users'
    ];
    
    // First backup each table
    for (const table of tables) {
      console.log(`Backing up ${table}...`);
      
      // Query all data from the table
      const result = await pool.query(`SELECT * FROM ${table}`);
      
      // Write data to a JSON file
      const backupFile = path.join(backupDir, `${table}_${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(result.rows, null, 2));
      
      console.log(`Backup of ${table} completed. File: ${backupFile}`);
    }
    
    console.log('Database backup completed successfully.');
    return true;
  } catch (error) {
    console.error('Error during database backup:', error);
    return false;
  }
}

// Clear all tables
async function clearTables() {
  try {
    console.log('Clearing all tables...');
    
    // Tables to clear in reverse order to respect foreign key constraints
    const tables = [
      'questionnaire_responses', 
      'independent_assignments', 
      'appointments', 
      'availabilities', 
      'users'
    ];
    
    // Clear each table
    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`Table ${table} cleared successfully.`);
    }
    
    console.log('All tables have been cleared.');
    return true;
  } catch (error) {
    console.error('Error clearing tables:', error);
    return false;
  }
}

// Main function to import users
async function importUsers() {
  try {
    // Create backup first
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
      console.error('Backup failed. Aborting operation.');
      return;
    }
    
    // Clear all tables
    const clearSuccess = await clearTables();
    if (!clearSuccess) {
      console.error('Failed to clear tables. Aborting operation.');
      return;
    }
    
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${usersData.length} users to import.`);
    
    // Process and import each user
    let successCount = 0;
    let failCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    
    for (const user of usersData) {
      try {
        // Determine role based on section
        const role = teacherGroups.includes(user.section) ? 'teacher' : 'student';
        
        // Update counters
        if (role === 'teacher') {
          teacherCount++;
        } else {
          studentCount++;
        }
        
        // Map section
        const sectionValue = mapSectionToEnum(user.section);
        
        // Hash password
        const hashedPassword = await hashPassword(user.secret_code);
        
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
          user.username,
          hashedPassword,
          role,
          sectionValue,
          null, // telegram_username is null initially
          null  // telegram_id is null initially
        ];
        
        const result = await pool.query(query, values);
        
        successCount++;
        console.log(`Registered user ID ${result.rows[0].id}: ${user.username} as ${role}`);
      } catch (error) {
        failCount++;
        console.error(`Error registering user ${user.name}:`, error.message);
      }
    }
    
    console.log('\nUser import summary:');
    console.log(`Total users processed: ${usersData.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${failCount}`);
    console.log(`Teachers registered: ${teacherCount}`);
    console.log(`Students registered: ${studentCount}`);
    
    console.log('\nUser import completed!');
  } catch (error) {
    console.error('Unhandled error during user import:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the import
importUsers();