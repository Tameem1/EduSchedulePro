import pg from 'pg';

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateSectionEnum() {
  const client = await pool.connect();
  try {
    console.log('Starting to update section enum...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // First, check current enum values
    const checkEnum = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'section'
      ORDER BY enumsortorder;
    `);
    
    console.log('Current section enum values:', checkEnum.rows.map(row => row.enumlabel));
    
    // Create a temporary column to hold the existing values
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN temp_section text;
    `);
    
    // Copy current section values to the temporary column
    await client.query(`
      UPDATE users 
      SET temp_section = section::text 
      WHERE section IS NOT NULL;
    `);
    
    console.log('Copied existing section values to temporary column');
    
    // Drop existing section column
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN section;
    `);
    
    console.log('Dropped old section column');
    
    // Drop existing section enum type
    await client.query(`
      DROP TYPE section;
    `);
    
    console.log('Dropped old section enum type');
    
    // Create new section enum with all the required values
    await client.query(`
      CREATE TYPE section AS ENUM (
        'aasem', 'khaled', 'mmdoh', 'obada', 'awab', 
        'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud'
      );
    `);
    
    console.log('Created new section enum type with updated values');
    
    // Add section column back with new enum type
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN section section;
    `);
    
    console.log('Added new section column with updated enum type');
    
    // Map old values to new values for the update
    // This is just a basic mapping as an example
    const valueMapping = {
      'section1': 'aasem',
      'section2': 'khaled',
      'section3': 'mmdoh',
      'section4': 'obada',
      'section5': 'awab',
      'section6': 'zuhair',
      'section7': 'yahia',
      'section8': 'omar',
      'section9': 'motaa',
      'section10': 'mahmoud'
    };
    
    // Update for each possible section value
    for (const [oldValue, newValue] of Object.entries(valueMapping)) {
      await client.query(`
        UPDATE users 
        SET section = $1::section 
        WHERE temp_section = $2;
      `, [newValue, oldValue]);
      
      console.log(`Mapped ${oldValue} to ${newValue}`);
    }
    
    // Drop temporary column
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN temp_section;
    `);
    
    console.log('Dropped temporary column');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Successfully updated section enum and migrated existing data!');
    
    // Verify new enum values
    const verifyEnum = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'section'
      ORDER BY enumsortorder;
    `);
    
    console.log('New section enum values:', verifyEnum.rows.map(row => row.enumlabel));
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error updating section enum:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the update
updateSectionEnum();