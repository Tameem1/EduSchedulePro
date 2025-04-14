import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Hash password function
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
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

// Update JSON file to change "name" to "username" and "group" to "section"
async function updateJsonFile() {
  try {
    console.log('Updating JSON file structure...');
    
    // Read the original JSON file
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Create backup of original file
    const backupFilePath = path.join(__dirname, 'attached_assets', 'students_backup.json');
    fs.writeFileSync(backupFilePath, JSON.stringify(usersData, null, 2));
    console.log(`Created backup of original file at ${backupFilePath}`);
    
    // Transform each user object
    const updatedUsersData = usersData.map(user => {
      const updatedUser = { ...user };
      
      // Rename "name" field to "username"
      if (user.name !== undefined) {
        updatedUser.username = user.name;
        delete updatedUser.name;
      }
      
      // Rename "group" field to "section"
      if (user.group !== undefined) {
        updatedUser.section = user.group;
        delete updatedUser.group;
      }
      
      return updatedUser;
    });
    
    // Write the updated JSON file
    const updatedFilePath = path.join(__dirname, 'attached_assets', 'students_updated.json');
    fs.writeFileSync(updatedFilePath, JSON.stringify(updatedUsersData, null, 2));
    
    console.log(`Updated JSON file created at ${updatedFilePath}`);
    console.log(`Total records processed: ${updatedUsersData.length}`);
    
    return {
      path: updatedFilePath,
      count: updatedUsersData.length
    };
  } catch (error) {
    console.error('Error updating JSON file:', error);
    return null;
  }
}

// Main function to delete all users and update JSON
async function deleteAndUpdateUsers() {
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
    
    // Update JSON file
    const jsonUpdateResult = await updateJsonFile();
    if (!jsonUpdateResult) {
      console.error('Failed to update JSON file. Aborting operation.');
      return;
    }
    
    console.log('\nOperation summary:');
    console.log('- Database tables cleared successfully');
    console.log(`- JSON file updated with ${jsonUpdateResult.count} records`);
    console.log(`- Updated JSON file location: ${jsonUpdateResult.path}`);
    console.log('\nTo use the updated JSON file for importing users:');
    console.log('1. Rename students_updated.json to students.json if you want to replace the original');
    console.log('2. Use the import_users.js script to re-import users with the updated structure');
    
  } catch (error) {
    console.error('Unhandled error during operation:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the operation
deleteAndUpdateUsers();