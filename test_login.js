import axios from 'axios';
import pg from 'pg';

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Sample random users to test login
async function testLogins() {
  try {
    console.log('==========================================');
    console.log('TESTING LOGIN WITH MIGRATED USER ACCOUNTS');
    console.log('==========================================');
    
    // Get 5 random students and 2 random teachers
    const studentResults = await pool.query(`
      SELECT id, username FROM users 
      WHERE role = 'student' 
      ORDER BY RANDOM() 
      LIMIT 5
    `);
    
    const teacherResults = await pool.query(`
      SELECT id, username FROM users 
      WHERE role = 'teacher' 
      ORDER BY RANDOM() 
      LIMIT 2
    `);
    
    const users = [...studentResults.rows, ...teacherResults.rows];
    
    console.log(`Selected ${users.length} users for login tests`);
    
    let successCount = 0;
    
    // Test login for each user
    for (const user of users) {
      try {
        // Use user ID as password (this is what we set during the migration)
        const password = user.id.toString();
        
        console.log(`Testing login for ${user.username} (ID: ${user.id})`);
        
        // Attempt login using the correct Replit URL
        const replit_domain = process.env.REPLIT_DOMAIN || 'https://workspace.replit.dev';
        const response = await axios.post(`${replit_domain}/api/login`, {
          username: user.username,
          password: password
        });
        
        if (response.status === 200 && response.data) {
          console.log(`✅ Login successful for ${user.username}`);
          successCount++;
        } else {
          console.log(`❌ Login failed for ${user.username} despite 200 status code`);
        }
      } catch (error) {
        console.log(`❌ Login failed for ${user.username}: ${error.response?.status} ${error.response?.data?.error || error.message}`);
      }
      
      console.log('-----------------------------------');
    }
    
    console.log(`\nLogin test results: ${successCount}/${users.length} successful logins`);
    console.log('==========================================');
  } catch (error) {
    console.error('Error during login tests:', error);
  } finally {
    await pool.end();
  }
}

// Run the tests
testLogins();