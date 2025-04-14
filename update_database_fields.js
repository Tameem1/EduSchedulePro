import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

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

// Check if columns exist
async function checkColumns() {
  try {
    // Query for column information in users table
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
    `;
    
    const result = await pool.query(columnsQuery);
    const columns = result.rows.map(row => row.column_name);
    
    console.log('Current columns in users table:', columns);
    
    // Check if username and section columns exist
    const hasUsername = columns.includes('username');
    const hasName = columns.includes('name');
    const hasSection = columns.includes('section');
    const hasGroup = columns.includes('group');
    
    return {
      hasUsername,
      hasName,
      hasSection,
      hasGroup
    };
  } catch (error) {
    console.error('Error checking columns:', error);
    throw error;
  }
}

// Rename columns if needed
async function renameColumns(columnInfo) {
  try {
    await pool.query('BEGIN');
    
    // If name exists but username doesn't, rename name to username
    if (columnInfo.hasName && !columnInfo.hasUsername) {
      console.log('Renaming "name" column to "username"...');
      await pool.query('ALTER TABLE users RENAME COLUMN name TO username');
      console.log('Column renamed successfully.');
    } else if (columnInfo.hasName && columnInfo.hasUsername) {
      console.log('Both "name" and "username" columns exist. No renaming needed.');
    } else if (!columnInfo.hasName && !columnInfo.hasUsername) {
      console.log('Neither "name" nor "username" column exists. Cannot proceed with rename.');
    } else {
      console.log('"username" column already exists. No renaming needed.');
    }
    
    // If group exists but section doesn't, rename group to section
    if (columnInfo.hasGroup && !columnInfo.hasSection) {
      console.log('Renaming "group" column to "section"...');
      await pool.query('ALTER TABLE users RENAME COLUMN "group" TO section');
      console.log('Column renamed successfully.');
    } else if (columnInfo.hasGroup && columnInfo.hasSection) {
      console.log('Both "group" and "section" columns exist. No renaming needed.');
    } else if (!columnInfo.hasGroup && !columnInfo.hasSection) {
      console.log('Neither "group" nor "section" column exists. Cannot proceed with rename.');
    } else {
      console.log('"section" column already exists. No renaming needed.');
    }
    
    await pool.query('COMMIT');
    console.log('Column renaming completed successfully.');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error renaming columns:', error);
    return false;
  }
}

// Main function
async function updateDatabaseFields() {
  try {
    // Create backup first
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
      console.error('Backup failed. Aborting operation.');
      return;
    }
    
    // Check columns
    const columnInfo = await checkColumns();
    
    // Rename columns if needed
    const renameSuccess = await renameColumns(columnInfo);
    if (!renameSuccess) {
      console.error('Failed to rename columns. Aborting operation.');
      return;
    }
    
    // Verify column changes
    const updatedColumnInfo = await checkColumns();
    
    console.log('\nOperation summary:');
    console.log(`- Initial state: username=${columnInfo.hasUsername}, name=${columnInfo.hasName}, section=${columnInfo.hasSection}, group=${columnInfo.hasGroup}`);
    console.log(`- Final state: username=${updatedColumnInfo.hasUsername}, name=${updatedColumnInfo.hasName}, section=${updatedColumnInfo.hasSection}, group=${updatedColumnInfo.hasGroup}`);
    
  } catch (error) {
    console.error('Unhandled error during operation:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the operation
updateDatabaseFields();