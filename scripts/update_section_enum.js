import pg from 'pg';

// Connection setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateSectionEnum() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Backing up existing users data...');
    const usersResult = await client.query('SELECT * FROM users');
    console.log(`Backed up ${usersResult.rows.length} user records.`);
    
    // Map old sections to new sections
    const sectionMapping = {
      'section1': 'aasem',
      'section2': 'khaled',
      'section3': 'mmdoh',
      'section4': 'obada',
      'section5': 'zuhair'
    };
    
    // Update the section enum type
    console.log('Updating section enum type...');
    
    // Step 1: Create a temporary column with the new type
    await client.query(`
      ALTER TABLE users
      ADD COLUMN new_section VARCHAR(50)
    `);
    
    // Step 2: Transfer data to the new column with mapping
    console.log('Transferring section data to new column with proper mapping...');
    for (const user of usersResult.rows) {
      let newSection = user.section; // keep original if no mapping
      
      if (user.section in sectionMapping) {
        // Map old section to new section name
        newSection = sectionMapping[user.section];
      }
      
      // If null or not in mapping, get it from the group name in the original data
      if (!newSection) {
        // Use the original group from the import file
        // For now, set it to null, we'll update from the import file later
        newSection = null;
      }
      
      await client.query(
        'UPDATE users SET new_section = $1 WHERE id = $2',
        [newSection, user.id]
      );
    }
    
    // Step C: Drop the old section column
    console.log('Dropping old section column...');
    await client.query('ALTER TABLE users DROP COLUMN section');
    
    // Step D: Create a new section enum type
    console.log('Creating new section enum type...');
    await client.query(`
      DROP TYPE IF EXISTS new_section CASCADE;
      CREATE TYPE new_section AS ENUM (
        'aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud'
      );
    `);
    
    // Step E: Add a new column with the new enum type
    await client.query(`
      ALTER TABLE users
      ADD COLUMN section new_section
    `);
    
    // Step F: Convert and copy the data from the temporary column
    console.log('Copying data to new enum column...');
    await client.query(`
      UPDATE users
      SET section = new_section::new_section
      WHERE new_section IS NOT NULL
    `);
    
    // Step G: Drop the temporary column
    console.log('Dropping temporary column...');
    await client.query('ALTER TABLE users DROP COLUMN new_section');
    
    // Step H: Rename the new type to the original name
    console.log('Renaming enum type...');
    await client.query(`
      ALTER TYPE new_section RENAME TO section;
    `);
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Section enum update completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating section enum:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateSectionEnum();