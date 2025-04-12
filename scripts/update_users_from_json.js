import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateUsersFromJson() {
  try {
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, '..', 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${usersData.length} users in JSON file.`);
    
    // Create a map of users by ID for quick lookup
    const userMap = new Map();
    for (const user of usersData) {
      userMap.set(user.id, user);
    }
    
    // Count of duplicated usernames
    const duplicateUsernamePattern = /_\d+$/; // matches _123 at the end of a string
    
    // Update the section and usernames from the original data
    console.log('Updating users from original data source...');
    
    // First, get all users from the database
    const dbUsers = await pool.query('SELECT id, username FROM users');
    
    let updatedCount = 0;
    let skippedCount = 0;
    let fixedUsernames = 0;
    
    for (const dbUser of dbUsers.rows) {
      try {
        // Find the corresponding user in the JSON data
        const originalUser = userMap.get(dbUser.id);
        
        if (!originalUser) {
          console.log(`No original data found for user with ID ${dbUser.id}, skipping.`);
          skippedCount++;
          continue;
        }
        
        // Check if the username has been modified with _ID pattern
        let needsUsernameUpdate = false;
        if (duplicateUsernamePattern.test(dbUser.username)) {
          needsUsernameUpdate = true;
          fixedUsernames++;
        }
        
        // Update the user with the original group as the section
        // and restore original username if needed
        await pool.query(
          'UPDATE users SET section = $1, username = $2 WHERE id = $3',
          [
            originalUser.group, 
            needsUsernameUpdate ? originalUser.name : dbUser.username,
            dbUser.id
          ]
        );
        
        updatedCount++;
        console.log(`Updated user ID ${dbUser.id}: section=${originalUser.group}, ${needsUsernameUpdate ? 'fixed username to ' + originalUser.name : 'kept username'}`);
      } catch (error) {
        console.error(`Error updating user with ID ${dbUser.id}:`, error.message);
      }
    }
    
    console.log('\nUser update summary:');
    console.log(`Total users in database: ${dbUsers.rows.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Usernames fixed: ${fixedUsernames}`);
    console.log(`Skipped (no original data): ${skippedCount}`);
    
    console.log('\nUser update completed!');
  } catch (error) {
    console.error('Unhandled error during user update:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the update
updateUsersFromJson();