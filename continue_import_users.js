// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Define teacher sections
const teacherSections = ['mmdoh', 'khaled', 'obada', 'awab', 'zuhair', 'yahia', 'kibar'];

// Function to hash password
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Function to continue importing users from a specific index
async function continueImportingUsers(startBatchIndex) {
  try {
    // Read users from JSON file
    console.log('Reading users from JSON file...');
    const jsonFilePath = path.join(__dirname, 'attached_assets', 'students.json');
    const usersData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    console.log(`Found ${usersData.length} users in JSON file.`);
    
    // Set batch size
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(usersData.length / BATCH_SIZE);
    
    // Get the count of users already in the database
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const existingCount = parseInt(countResult.rows[0].count);
    console.log(`There are already ${existingCount} users in the database.`);
    
    // Start from the specified batch based on count
    let startBatch = startBatchIndex || Math.floor(existingCount / BATCH_SIZE) + 1;
    console.log(`Starting from batch ${startBatch}/${totalBatches}`);
    if (startBatch > totalBatches) {
      console.log('All batches have already been processed.');
      return;
    }
    
    // Process users in batches
    let successCount = 0;
    let failCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    
    // Process remaining batches
    for (let batchNum = startBatch - 1; batchNum < totalBatches; batchNum++) {
      const start = batchNum * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, usersData.length);
      const batchUsers = usersData.slice(start, end);
      
      console.log(`Processing batch ${batchNum + 1}/${totalBatches} (users ${start + 1}-${end})...`);
      
      // Begin transaction for this batch
      await pool.query('BEGIN');
      
      // Process each user in the batch
      for (const user of batchUsers) {
        try {
          // Determine role based on section
          const section = user.group; // Map group to section
          const role = teacherSections.includes(section) ? 'teacher' : 'student';
          
          // Update counters
          if (role === 'teacher') {
            teacherCount++;
          } else {
            studentCount++;
          }
          
          // Hash password (secret_code)
          const hashedPassword = await hashPassword(user.secret_code);
          
          // Insert user with mapped fields
          const query = `
            INSERT INTO users (id, username, password, role, section, telegram_username)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE
            SET username = $2, password = $3, role = $4, section = $5, telegram_username = $6
            RETURNING id
          `;
          
          const values = [
            user.id,
            user.name,                // Map name to username
            hashedPassword,           // Map hashed secret_code to password
            role,
            section,                  // Map group to section
            null                      // telegram_username is null initially
          ];
          
          const result = await pool.query(query, values);
          
          successCount++;
          console.log(`Registered user ID ${result.rows[0].id}: ${user.name} as ${role}`);
        } catch (error) {
          failCount++;
          console.error(`Error registering user ${user.name}:`, error.message);
        }
      }
      
      // Commit transaction for this batch
      await pool.query('COMMIT');
      console.log(`Batch ${batchNum + 1} completed and committed.`);
    }
    
    console.log('\nUser import summary:');
    console.log(`Total additional users processed: ${successCount + failCount}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${failCount}`);
    console.log(`Additional teachers registered: ${teacherCount}`);
    console.log(`Additional students registered: ${studentCount}`);
    
    // Get final count of users in the database
    const finalCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    console.log(`\nTotal users in database: ${finalCount}`);
    
    console.log('\nUser import completed!');
  } catch (error) {
    // Rollback transaction in case of error
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Unhandled error during user import:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the import continuing from the next batch based on current count
continueImportingUsers(null).catch(error => {
  console.error('Error in batch import process:', error);
  process.exit(1);
});