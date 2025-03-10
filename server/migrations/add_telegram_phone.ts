
import { pool } from "../db";

// Perform database migration to rename telegram_id to telegram_phone
export default async function migrate() {
  try {
    // Check if the telegram_phone column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'telegram_phone'
    `;
    const checkResult = await pool.query(checkColumnQuery);

    // If column doesn't exist, add it
    if (checkResult.rows.length === 0) {
      console.log('Renaming telegram_id column to telegram_phone in users table');
      
      // First check if telegram_id exists
      const checkIdColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'telegram_id'
      `;
      const idColumnResult = await pool.query(checkIdColumnQuery);
      
      if (idColumnResult.rows.length > 0) {
        // Rename column from telegram_id to telegram_phone
        await pool.query(`
          ALTER TABLE users 
          RENAME COLUMN telegram_id TO telegram_phone
        `);
      } else {
        // If telegram_id doesn't exist, create telegram_phone
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS telegram_phone VARCHAR(255)
        `);
      }
      return true;
    } else {
      console.log('telegram_phone column already exists in users table');
      return false;
    }
  } catch (error) {
    console.error('Error in add_telegram_phone migration:', error);
    throw error;
  }
}
