
import { pool } from '../server/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportUsersTable() {
  try {
    console.log('Starting users table export...');
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get current timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupFile = path.join(backupDir, `users_${timestamp}.sql`);

    // Get table schema
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    // Start building SQL file content
    let sqlContent = '-- Users table backup\n\n';
    
    // Add CREATE TABLE statement
    sqlContent += 'CREATE TABLE IF NOT EXISTS users (\n';
    schemaResult.rows.forEach((col, index) => {
      let colDef = `  ${col.column_name} ${col.data_type}`;
      if (col.character_maximum_length) {
        colDef += `(${col.character_maximum_length})`;
      }
      sqlContent += colDef + (index < schemaResult.rows.length - 1 ? ',\n' : '\n');
    });
    sqlContent += ');\n\n';

    // Get all data from users table
    const dataResult = await pool.query('SELECT * FROM users;');
    
    // Add INSERT statements
    dataResult.rows.forEach(row => {
      const columns = Object.keys(row).join(', ');
      const values = Object.values(row).map(val => 
        typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val
      ).join(', ');
      
      sqlContent += `INSERT INTO users (${columns}) VALUES (${values});\n`;
    });

    // Write to file
    fs.writeFileSync(backupFile, sqlContent);
    
    console.log(`Users table exported successfully to: ${backupFile}`);
  } catch (error) {
    console.error('Error exporting users table:', error);
  } finally {
    await pool.end();
  }
}

exportUsersTable();
