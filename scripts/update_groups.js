
import fs from 'fs';
import path from 'path';
import { pool } from '../server/db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateGroups() {
  try {
    // Read students.json file
    const studentsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'attached_assets', 'students.json'), 'utf8'));
    
    console.log(`Found ${studentsData.length} users to update.`);
    
    // Process each user
    for (const student of studentsData) {
      try {
        const query = `
          UPDATE users 
          SET "group" = $1
          WHERE id = $2
        `;
        
        const result = await pool.query(query, [student.group, student.id]);
        
        if (result.rowCount > 0) {
          console.log(`Updated group for user ID ${student.id} to ${student.group}`);
        }
      } catch (error) {
        console.error(`Error updating user ${student.id}:`, error);
      }
    }
    
    console.log('Group updates completed!');
  } catch (error) {
    console.error('Error during group update process:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateGroups();
