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