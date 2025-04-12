const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../server/db');

// Define teacher groups
const teacherGroups = ['aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia'];

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
  // For simplicity, we'll map different groups to different sections
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

async function createBackupAndClearTables() {
  try {
    console.log('Running backup before clearing tables...');
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get current timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    // Tables to backup and clear
    // We'll clear them in reverse order to respect foreign key constraints
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
    
    // Then clear tables in reverse order
    console.log('Clearing tables...');
    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`Table ${table} cleared successfully.`);
    }
    
    console.log('All tables have been backed up and cleared.');
    return true;
  } catch (error) {
    console.error('Error during backup and clear operation:', error);
    return false;
  }
}

async function registerUsersFromJson() {
  try {
    // First create a backup and clear tables
    const backupSuccess = await createBackupAndClearTables();
    if (!backupSuccess) {
      console.error('Backup failed, aborting user registration');
      return;
    }
    
    // Read students.json file
    const studentsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'attached_assets', 'students.json'), 'utf8'));
    
    console.log(`Found ${studentsData.length} users to register.`);
    
    // Process and register each user
    for (const student of studentsData) {
      try {
        // Determine role based on group
        const role = teacherGroups.includes(student.group) ? 'teacher' : 'student';
        
        // Map section
        const section = mapSectionToEnum(student.group);
        
        // Hash password
        const hashedPassword = await hashPassword(student.secret_code);
        
        // Insert user
        const query = `
          INSERT INTO users (id, username, password, role, section, telegram_username, telegram_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE
          SET username = $2, password = $3, role = $4, section = $5, telegram_username = $6, telegram_id = $7
          RETURNING id
        `;
        
        const result = await pool.query(query, [
          student.id,
          student.name,
          hashedPassword,
          role,
          section,
          null, // telegram_username is set to null initially
          null  // telegram_id is set to null initially
        ]);
        
        console.log(`Registered user ID ${result.rows[0].id}: ${student.name} as ${role}`);
      } catch (error) {
        console.error(`Error registering user ${student.name}:`, error);
      }
    }
    
    console.log('User registration completed!');
  } catch (error) {
    console.error('Error during user registration process:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
registerUsersFromJson();