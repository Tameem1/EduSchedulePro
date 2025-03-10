
import { pool } from '../db';

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Checking if telegram_id column exists...');
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='telegram_id'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('Adding telegram_id column to users table...');
      await client.query(`
        ALTER TABLE users
        ADD COLUMN telegram_id TEXT
      `);
      console.log('telegram_id column added successfully');
    } else {
      console.log('telegram_id column already exists');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrate().then(() => {
    console.log('Migration completed');
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

export default migrate;
import { pool } from "../db";

// Perform database migration to add telegram_id column to users table
export default async function migrate() {
  try {
    // Check if the telegram_id column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'telegram_id'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    // If column doesn't exist, add it
    if (checkResult.rows.length === 0) {
      console.log('Adding telegram_id column to users table');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255)
      `);
      return true;
    } else {
      console.log('telegram_id column already exists in users table');
      return false;
    }
  } catch (error) {
    console.error('Error in add_telegram_id migration:', error);
    throw error;
  }
}
