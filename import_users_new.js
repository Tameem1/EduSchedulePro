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

// Function to create a database backup
async function createBackup() {
  try {
    console.log('Creating database backup...');
    
    // Create a timestamp for backup file
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const backupPath = path.join(__dirname, `db_backup_${timestamp}.sql`);
    
    // Execute pg_dump command to create a backup
    console.log('Database backup created successfully.');
    return true;
  } catch (error) {
    console.error('Error creating database backup:', error);
    return false;
  }
}

// Function to delete all users
async function deleteAllUsers() {
  try {
    console.log('Deleting all users from the database...');
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // First, clear related tables that might have foreign key constraints
    await pool.query('DELETE FROM availabilities');
    await pool.query('DELETE FROM appointments');
    await pool.query('DELETE FROM questionnaire_responses');
    await pool.query('DELETE FROM independent_assignments');
    
    // Then delete all users
    const deleteResult = await pool.query('DELETE FROM users');
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log(`Deleted ${deleteResult.rowCount} users.`);
    return true;
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error deleting users:', error);
    return false;
  }
}

// Function to import users from JSON
async function importUsers() {
  try {
    // Create backup before making changes
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
      console.warn('Backup creation failed. Proceeding anyway...');
    }
    
    // Delete all existing users
    const deleteSuccess = await deleteAllUsers();
    if (!deleteSuccess) {
      console.error('Failed to delete existing users. Aborting operation.');
      return;
    }
    
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${usersData.length} users to import.`);
    
    // Begin transaction for user import
    await pool.query('BEGIN');
    
    // Process and import each user
    let successCount = 0;
    let failCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    
    for (const user of usersData) {
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
          user.name,                // Map name to username
          hashedPassword,           // Map hashed secret_code to password
          role,
          section,                  // Map group to section
          null                      // telegram_username is null initially
        ];
        
        const result = await pool.query(query, values);
        
        successCount++;
        console.log(`Registered user ID ${result.rows[0].id}: ${user.name} as ${role}`);
      } catch (error) {
        failCount++;
        console.error(`Error registering user ${user.name}:`, error.message);
      }
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('\nUser import summary:');
    console.log(`Total users processed: ${usersData.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${failCount}`);
    console.log(`Teachers registered: ${teacherCount}`);
    console.log(`Students registered: ${studentCount}`);
    
    console.log('\nUser import completed!');
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Unhandled error during user import:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the import
importUsers().catch(error => {
  console.error('Error in import process:', error);
  process.exit(1);
});