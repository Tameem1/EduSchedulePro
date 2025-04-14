import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixJaddubaiSections() {
  console.log('Starting to fix jaddubai section values...');
  
  try {
    // Load the JSON file
    const filePath = resolve('./attached_assets/students.json');
    console.log(`Reading students data from ${filePath}`);
    const jsonData = JSON.parse(readFileSync(filePath, 'utf8'));
    
    // Filter for jaddubai students
    const jaddubaiStudents = jsonData.filter(student => student.group === 'jaddubai');
    console.log(`Found ${jaddubaiStudents.length} students with jaddubai section in JSON file`);
    
    // Log the names for debugging
    console.log("Jaddubai student names:", jaddubaiStudents.map(s => s.name).join(', '));
    
    // Begin a transaction
    await pool.query('BEGIN');
    
    // Process each jaddubai student
    let updatedCount = 0;
    for (const student of jaddubaiStudents) {
      // Update the section value
      const result = await pool.query(`
        UPDATE users 
        SET section = 'jaddubai' 
        WHERE username = $1 
        RETURNING id, username, section
      `, [student.name]);
      
      if (result.rows.length > 0) {
        console.log(`Updated: ${result.rows[0].username} (ID: ${result.rows[0].id}) to section: jaddubai`);
        updatedCount++;
      } else {
        console.log(`User not found: ${student.name}`);
      }
    }
    
    console.log(`Successfully updated ${updatedCount} users to jaddubai section`);
    
    // Now verify the updates
    const verifyResult = await pool.query(`
      SELECT id, username, section FROM users 
      WHERE section = 'jaddubai'
    `);
    
    console.log(`After update, found ${verifyResult.rows.length} users with jaddubai section`);
    if (verifyResult.rows.length > 0) {
      console.log("Users with jaddubai section:");
      verifyResult.rows.forEach(row => {
        console.log(`${row.username} (ID: ${row.id})`);
      });
    }
    
    await pool.query('COMMIT');
    
    // Also update all users with any section value to match the JSON
    console.log('\nUpdating all other user sections to match JSON data...');
    
    // Get all users
    const usersResult = await pool.query(`
      SELECT id, username, section FROM users
    `);
    
    // Create a map of name -> section from JSON
    const sectionMap = {};
    jsonData.forEach(student => {
      if (student.group) {
        sectionMap[student.name] = student.group;
      }
    });
    
    // Begin a new transaction
    await pool.query('BEGIN');
    
    // Update each user
    let totalUpdates = 0;
    for (const user of usersResult.rows) {
      const jsonSection = sectionMap[user.username];
      
      if (jsonSection && jsonSection !== user.section) {
        await pool.query(`
          UPDATE users SET section = $1 WHERE id = $2
        `, [jsonSection, user.id]);
        
        console.log(`Updated user ${user.username} (ID: ${user.id}) from section ${user.section} to ${jsonSection}`);
        totalUpdates++;
      }
    }
    
    console.log(`Updated section values for ${totalUpdates} additional users`);
    
    await pool.query('COMMIT');
    console.log('All updates committed to the database');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error fixing section values:', error);
  } finally {
    // Close the database connection
    pool.end();
    console.log('Database connection closed');
  }
}

// Execute the update
fixJaddubaiSections()
  .then(() => {
    console.log('Update process completed successfully');
  })
  .catch(error => {
    console.error('Update process failed:', error);
  });