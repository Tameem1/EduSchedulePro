import fs from 'fs';
import path from 'path';
import { pool } from '../server/db.js';
import { fileURLToPath } from 'url';

// Get current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupDatabase() {
  try {
    console.log('Starting database backup...');
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get current timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    // Tables to backup
    const tables = ['users', 'availabilities', 'appointments', 'questionnaire_responses', 'independent_assignments'];
    
    for (const table of tables) {
      console.log(`Backing up ${table}...`);
      
      // Query all data from the table
      const result = await pool.query(`SELECT * FROM ${table}`);
      
      // Write data to a JSON file
      const backupFile = path.join(backupDir, `${table}_${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(result.rows, null, 2));
      
      console.log(`Backup of ${table} completed. File: ${backupFile}`);
    }
    
    console.log('Database backup completed successfully!');
  } catch (error) {
    console.error('Error during database backup:', error);
  } finally {
    await pool.end();
  }
}

backupDatabase();