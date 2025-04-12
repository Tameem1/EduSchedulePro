import pg from 'pg';

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkPasswords() {
  try {
    console.log('Checking password format for sample users...');
    
    // Get a sample of users
    const result = await pool.query('SELECT id, username, password FROM users LIMIT 10');
    const users = result.rows;
    
    // Check each user's password format
    for (const user of users) {
      // Check if password follows the expected format (hash.salt)
      const hasSaltFormat = user.password.includes('.') && user.password.split('.').length === 2;
      console.log(`User ID ${user.id}: ${user.username}`);
      console.log(`  Password format is correct: ${hasSaltFormat}`);
      console.log(`  Password sample: ${user.password.substring(0, 20)}...`);
      console.log('');
    }
    
    console.log('Password check completed!');
  } catch (error) {
    console.error('Error during password check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPasswords();