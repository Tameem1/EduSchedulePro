import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateSectionValuesFromJson() {
  console.log('Starting to update section values from JSON file...');
  
  try {
    // Load the JSON file
    const filePath = resolve('./attached_assets/students.json');
    console.log(`Reading students data from ${filePath}`);
    const jsonData = JSON.parse(readFileSync(filePath, 'utf8'));
    console.log(`Found ${jsonData.length} student records in the JSON file`);
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Get the current usernames in the users table
    const usersResult = await pool.query(`
      SELECT id, username FROM users WHERE role = 'student'
    `);
    
    console.log(`Found ${usersResult.rows.length} students in the database`);
    
    // Map usernames to IDs for easier lookup
    const userMap = new Map();
    usersResult.rows.forEach(user => {
      userMap.set(user.username, user.id);
    });
    
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundUsers = [];
    
    // Process each student record from the JSON
    for (const student of jsonData) {
      const { name, group } = student;
      
      // Skip if no group value
      if (!group) {
        console.log(`Skipping ${name} - no group value found`);
        continue;
      }
      
      const userId = userMap.get(name);
      if (userId) {
        // Update section value for this user
        await pool.query(`
          UPDATE users 
          SET section = $1 
          WHERE id = $2
        `, [group, userId]);
        
        if (updatedCount % 100 === 0) {
          console.log(`Progress: Updated ${updatedCount} users so far...`);
        }
        
        updatedCount++;
      } else {
        notFoundCount++;
        // Keep track of first 10 users not found for diagnostic purposes
        if (notFoundUsers.length < 10) {
          notFoundUsers.push(name);
        }
      }
    }
    
    console.log(`Successfully updated ${updatedCount} users with section values`);
    
    if (notFoundCount > 0) {
      console.log(`Could not find ${notFoundCount} users in the database`);
      console.log(`First few users not found: ${notFoundUsers.join(', ')}`);
    }
    
    await pool.query('COMMIT');
    console.log('All updates committed to the database');
    
    return {
      total: jsonData.length,
      updated: updatedCount,
      notFound: notFoundCount
    };
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating section values:', error);
    throw error;
  } finally {
    // Close the database connection
    pool.end();
    console.log('Database connection closed');
  }
}

// Execute the update function
updateSectionValuesFromJson()
  .then(results => {
    console.log('Update process completed successfully');
    console.log(`Summary: Total processed: ${results.total}, Updated: ${results.updated}, Not found: ${results.notFound}`);
  })
  .catch(error => {
    console.error('Update process failed:', error);
  });