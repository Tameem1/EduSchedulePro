// Script to apply section to group migration
const { Pool } = require('pg');
require('dotenv').config();

async function applyMigration() {
  console.log('Starting migration process: rename section to group...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    console.log('First checking if group column already exists...');
    const checkGroupColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'group'
    `);
    
    if (checkGroupColumn.rows.length > 0) {
      console.log('Group column already exists, skipping migration');
      await pool.query('COMMIT');
      return;
    }
    
    console.log('Converting section to text type...');
    await pool.query(`
      ALTER TABLE users 
      ALTER COLUMN section TYPE TEXT;
    `);
    
    console.log('Renaming section column to group...');
    await pool.query(`
      ALTER TABLE users 
      RENAME COLUMN section TO "group";
    `);
    
    console.log('Creating group enum type if it doesn\'t exist...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group') THEN
          CREATE TYPE "group" AS ENUM ('aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud');
        END IF;
      END$$;
    `);
    
    console.log('Converting group column to enum type...');
    await pool.query(`
      ALTER TABLE users 
      ALTER COLUMN "group" TYPE "group" USING "group"::text::"group";
    `);
    
    // Update routes to use group instead of section
    console.log('Migration completed successfully!');
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    pool.end();
  }
}

// Execute the migration
applyMigration().catch(err => {
  console.error('Error occurred during migration:', err);
  process.exit(1);
});