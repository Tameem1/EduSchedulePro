
import { pool } from "../db";

// Perform database migration to rename telegram_phone to telegram_username
export default async function migrate() {
  try {
    // Check if the telegram_username column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'telegram_username'
    `;
    const checkResult = await pool.query(checkColumnQuery);

    // If column doesn't exist, rename telegram_phone to telegram_username
    if (checkResult.rows.length === 0) {
      console.log('Renaming telegram_phone column to telegram_username in users table');
      
      // First check if telegram_phone exists
      const checkPhoneColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'telegram_phone'
      `;
      const phoneColumnResult = await pool.query(checkPhoneColumnQuery);
      
      if (phoneColumnResult.rows.length > 0) {
        // Rename column from telegram_phone to telegram_username
        await pool.query(`
          ALTER TABLE users 
          RENAME COLUMN telegram_phone TO telegram_username
        `);
      } else {
        // If telegram_phone doesn't exist, create telegram_username
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255)
        `);
      }
      return true;
    } else {
      console.log('telegram_username column already exists in users table');
      return false;
    }
  } catch (error) {
    console.error('Error in rename_telegram_field migration:', error);
    throw error;
  }
}
