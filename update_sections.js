import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateSections() {
  console.log('Starting to update section values from JSON file...');
  
  try {
    // Load the JSON file
    const filePath = resolve('./attached_assets/students.json');
    console.log(`Reading students data from ${filePath}`);
    const jsonData = JSON.parse(readFileSync(filePath, 'utf8'));
    console.log(`Found ${jsonData.length} student records in the JSON file`);
    
    // Get all users from the database for matching
    const usersResult = await pool.query(`
      SELECT id, username FROM users
    `);
    console.log(`Found ${usersResult.rows.length} users in the database`);
    
    // Create a map for easier lookup
    const users = {};
    for (const user of usersResult.rows) {
      users[user.username] = user.id;
    }
    
    // Count variables
    let updateCount = 0;
    let notFoundCount = 0;
    const specialSections = new Set();
    const notFoundNames = [];
    
    // Process each student record from the JSON
    for (const student of jsonData) {
      const { name, group } = student;
      
      // Skip if no group value
      if (!group) continue;
      
      // Track special sections
      if (!['aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud'].includes(group)) {
        specialSections.add(group);
      }
      
      // Check if user exists in the database
      if (users[name]) {
        const userId = users[name];
        
        // Update the section value
        await pool.query(`
          UPDATE users SET section = $1 WHERE id = $2
        `, [group, userId]);
        
        updateCount++;
        
        // Log progress
        if (updateCount % 10 === 0) {
          console.log(`Updated ${updateCount} users so far...`);
        }
      } else {
        notFoundCount++;
        if (notFoundNames.length < 10) {
          notFoundNames.push(name);
        }
      }
    }
    
    console.log(`Update completed. Updated ${updateCount} users.`);
    console.log(`Special sections found: ${Array.from(specialSections).join(', ')}`);
    
    if (notFoundCount > 0) {
      console.log(`Could not find ${notFoundCount} users in the database`);
      console.log(`Sample of users not found: ${notFoundNames.join(', ')}`);
    }
    
    // Verify some special sections were updated
    const specialResult = await pool.query(`
      SELECT username, section FROM users 
      WHERE section NOT IN ('aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud')
      LIMIT 10
    `);
    
    if (specialResult.rows.length > 0) {
      console.log('Examples of users with special sections:');
      specialResult.rows.forEach(row => {
        console.log(`${row.username}: ${row.section}`);
      });
    } else {
      console.log('No users with special sections found after update.');
    }
    
  } catch (error) {
    console.error('Error updating section values:', error);
  } finally {
    // Close the database connection
    pool.end();
    console.log('Database connection closed');
  }
}

// Execute the update
updateSections();