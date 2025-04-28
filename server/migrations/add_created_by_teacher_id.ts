import { pool, db } from "../db";
import { appointments } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Migration to add created_by_teacher_id to appointments table
 */
export async function up() {
  console.log('Running migration: add created_by_teacher_id field to appointments table');
  try {
    // Check if the column already exists
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='appointments' AND column_name='created_by_teacher_id'
    `);
    
    if (result.rows.length === 0) {
      // Add the column if it doesn't exist
      await pool.query(`
        ALTER TABLE appointments 
        ADD COLUMN created_by_teacher_id INTEGER REFERENCES users(id)
      `);
      console.log('Successfully added created_by_teacher_id column to appointments table');
    } else {
      console.log('created_by_teacher_id column already exists in appointments table');
    }
    
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

export async function down() {
  console.log('Reverting migration: removing created_by_teacher_id field from appointments table');
  try {
    await pool.query(`
      ALTER TABLE appointments 
      DROP COLUMN IF EXISTS created_by_teacher_id
    `);
    console.log('Successfully removed created_by_teacher_id column from appointments table');
    return true;
  } catch (error) {
    console.error('Migration reversion failed:', error);
    return false;
  }
}