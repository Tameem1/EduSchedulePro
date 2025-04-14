import { pool } from "../db.js";
import { readFileSync } from 'fs';

// Function to rename 'group' column to 'section' in users table
// and update values from students.json
export async function up() {
  console.log("Running rename_group_to_section migration (UP)");
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Check if section column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'section'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    // If section already exists, we can skip the rename
    if (checkResult.rows.length === 0) {
      console.log('Renaming group column to section...');
      
      // First check if group column exists
      const checkGroupColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'group'
      `;
      const groupColumnResult = await pool.query(checkGroupColumnQuery);
      
      if (groupColumnResult.rows.length > 0) {
        // First convert the group column to text type
        await pool.query(`
          ALTER TABLE users 
          ALTER COLUMN "group" TYPE TEXT;
        `);
        
        // Rename the column from group to section
        await pool.query(`
          ALTER TABLE users 
          RENAME COLUMN "group" TO section;
        `);
      } else {
        // If neither exists, add section
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS section TEXT;
        `);
      }
    } else {
      console.log('section column already exists in users table');
    }
    
    console.log('Migration completed successfully!');
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in rename_group_to_section migration:', error);
    throw error;
  }
}

// Function to update section values from JSON file
export async function updateSectionsFromJson() {
  console.log("Updating section values from JSON file");
  
  try {
    // Load the JSON file
    const jsonData = JSON.parse(readFileSync('./attached_assets/students.json', 'utf8'));
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Process each student record
    for (const student of jsonData) {
      const { name, group } = student;
      
      // Skip if no group value
      if (!group) continue;
      
      // Update section value for this name
      const updateQuery = `
        UPDATE users 
        SET section = $1 
        WHERE username = $2
      `;
      
      await pool.query(updateQuery, [group, name]);
    }
    
    console.log('Successfully updated section values from JSON file');
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating section values:', error);
    throw error;
  }
}

// Function to rollback to previous state
export async function down() {
  console.log("Running rename_group_to_section migration (DOWN)");
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Check if group column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'group'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    // If group doesn't exist, rename section back to group
    if (checkResult.rows.length === 0) {
      console.log('Renaming section column back to group...');
      
      // First check if section column exists
      const checkSectionColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'section'
      `;
      const sectionColumnResult = await pool.query(checkSectionColumnQuery);
      
      if (sectionColumnResult.rows.length > 0) {
        // Rename the column back to group
        await pool.query(`
          ALTER TABLE users 
          RENAME COLUMN section TO "group";
        `);
      }
    } else {
      console.log('group column already exists in users table');
    }
    
    console.log('Rollback completed successfully!');
    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in rename_group_to_section rollback:', error);
    throw error;
  }
}