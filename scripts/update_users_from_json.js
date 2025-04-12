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
    
    // Map for non-standard groups to our enum values
    const groupMapping = {
      'dubai-omar': 'omar',
      'bader': 'omar', // Mapping to a similar section
      'kibar': 'aasem', // Mapping to default section
      'other': 'aasem',  // Mapping to default section
    };
    
    // Count of duplicated usernames
    const duplicateUsernamePattern = /_\d+$/; // matches _123 at the end of a string
    
    // First, let's get a list of existing usernames to handle duplicates
    const existingUsernames = new Set();
    const usernameResult = await pool.query('SELECT username FROM users');
    usernameResult.rows.forEach(row => existingUsernames.add(row.username));
    
    console.log('Updating users from original data source...');
    
    // Get all users from the database
    const dbUsers = await pool.query('SELECT id, username FROM users');
    
    let updatedCount = 0;
    let skippedCount = 0;
    let fixedUsernames = 0;
    let mappedSections = 0;
    let duplicateHandled = 0;
    
    for (const dbUser of dbUsers.rows) {
      try {
        // Find the corresponding user in the JSON data
        const originalUser = userMap.get(dbUser.id);
        
        if (!originalUser) {
          console.log(`No original data found for user with ID ${dbUser.id}, skipping.`);
          skippedCount++;
          continue;
        }
        
        // Handle non-standard group names
        let section = originalUser.group;
        let sectionMapped = false;
        
        if (groupMapping[section]) {
          section = groupMapping[section];
          sectionMapped = true;
          mappedSections++;
        }
        
        // Check if the username has been modified with _ID pattern or needs to be restored
        let username = dbUser.username;
        let needsUsernameUpdate = false;
        
        if (duplicateUsernamePattern.test(dbUser.username)) {
          username = originalUser.name;
          needsUsernameUpdate = true;
          fixedUsernames++;
          
          // Check if this would create a duplicate
          if (existingUsernames.has(username) && username !== dbUser.username) {
            // Handle duplicate by appending ID
            username = `${username}_${dbUser.id}`;
            duplicateHandled++;
          }
        }
        
        // Update the user with the group as the section and possibly fix username
        await pool.query(
          'UPDATE users SET section = $1, username = $2 WHERE id = $3',
          [
            section, 
            username,
            dbUser.id
          ]
        );
        
        // If we updated the username, update our tracking set
        if (needsUsernameUpdate) {
          existingUsernames.delete(dbUser.username);
          existingUsernames.add(username);
        }
        
        updatedCount++;
        console.log(`Updated user ID ${dbUser.id}: section=${section}${sectionMapped ? ' (mapped)' : ''}, ${needsUsernameUpdate ? 'fixed username to ' + username : 'kept username'}`);
      } catch (error) {
        console.error(`Error updating user with ID ${dbUser.id}:`, error.message);
      }
    }
    
    console.log('\nUser update summary:');
    console.log(`Total users in database: ${dbUsers.rows.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Sections mapped: ${mappedSections}`);
    console.log(`Usernames fixed: ${fixedUsernames}`);
    console.log(`Duplicate usernames handled: ${duplicateHandled}`);
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