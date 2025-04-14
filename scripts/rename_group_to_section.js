import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function renameGroupToSection() {
  console.log('Starting migration: rename "group" column to "section"');
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Check if "group" column exists
    const checkGroupColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'group'
    `);
    
    if (checkGroupColumn.rows.length === 0) {
      console.log('Group column does not exist, checking for section column');
      
      // Check if section column already exists
      const checkSectionColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'section'
      `);
      
      if (checkSectionColumn.rows.length === 0) {
        console.log('Section column does not exist, creating it');
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN section TEXT;
        `);
      } else {
        console.log('Section column already exists');
      }
    } else {
      console.log('Group column exists, renaming to section');
      
      // Check if section already exists
      const checkSectionColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'section'
      `);
      
      if (checkSectionColumn.rows.length > 0) {
        console.log('Both group and section exist, dropping section first');
        await pool.query(`
          ALTER TABLE users 
          DROP COLUMN section;
        `);
      }
      
      // Converting group column to text type (if it's an enum)
      await pool.query(`
        ALTER TABLE users 
        ALTER COLUMN "group" TYPE TEXT;
      `);
      
      // Renaming column
      await pool.query(`
        ALTER TABLE users 
        RENAME COLUMN "group" TO section;
      `);
    }
    
    console.log('Column rename completed successfully');
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in migration:', error);
    throw error;
  }
}

async function updateSectionValues() {
  console.log('Updating section values from JSON file');
  
  try {
    // Load the JSON file
    const filePath = resolve('./attached_assets/students.json');
    console.log(`Reading students data from ${filePath}`);
    const jsonData = JSON.parse(readFileSync(filePath, 'utf8'));
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Get the current usernames in the users table
    const usersResult = await pool.query(`
      SELECT id, username FROM users WHERE role = 'student'
    `);
    
    const userMap = new Map();
    usersResult.rows.forEach(user => {
      userMap.set(user.username, user.id);
    });
    
    let updatedCount = 0;
    
    // Process each student record
    for (const student of jsonData) {
      const { name, group } = student;
      
      // Skip if no group value
      if (!group) continue;
      
      const userId = userMap.get(name);
      if (userId) {
        // Update section value for this user
        await pool.query(`
          UPDATE users 
          SET section = $1 
          WHERE id = $2
        `, [group, userId]);
        
        updatedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} users with section values`);
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating section values:', error);
    throw error;
  } finally {
    // Close the database connection
    pool.end();
  }
}

// Run the migrations sequentially
async function runMigrations() {
  try {
    // First rename the column
    await renameGroupToSection();
    
    // Then update values from JSON
    await updateSectionValues();
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Execute the migration script
runMigrations();