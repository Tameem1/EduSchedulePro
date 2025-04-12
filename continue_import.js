import { db } from './server/db.js';
import { users } from './shared/schema.js';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

function mapSectionToEnum(sectionName) {
  // Map the section name to the correct enum value
  const sectionMapping = {
    'aasem': 'aasem',
    'khaled': 'khaled',
    'mmdoh': 'mmdoh',
    'obada': 'obada',
    'awab': 'awab',
    'zuhair': 'zuhair',
    'yahia': 'yahia',
    'omar': 'omar',
    'motaa': 'motaa',
    'mahmoud': 'mahmoud',
    'dubai-omar': 'omar',
    'bader': 'omar',
    'kibar': 'omar',
    'other': 'omar'
  };
  
  return sectionMapping[sectionName.toLowerCase()] || 'omar';
}

async function getHighestUserId() {
  const result = await db.select({ id: users.id }).from(users).orderBy(users.id).limit(1);
  return result.length > 0 ? result[0].id : 0;
}

async function continueImport() {
  try {
    // Read the students.json file
    const data = fs.readFileSync('./attached_assets/students.json', 'utf8');
    const jsonData = JSON.parse(data);
    
    // Get the highest current user ID
    const highestId = await getHighestUserId();
    console.log(`Starting import from ID: ${highestId}`);
    
    // Filter to only include users with IDs higher than the highest current ID
    const newUsers = jsonData.filter(user => user.id > highestId);
    console.log(`Found ${newUsers.length} new users to import`);
    
    // Process each user
    for (const user of newUsers) {
      const section = mapSectionToEnum(user.section);
      
      // Determine role based on section
      const role = ['aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia'].includes(section)
        ? 'teacher'
        : 'student';
      
      // Hash the password (using phone or a default)
      const hashedPassword = await hashPassword(user.phone || '12345678');
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.username, user.name)).limit(1);
      
      if (existingUser.length === 0) {
        // Insert the new user
        await db.insert(users).values({
          id: user.id,
          username: user.name,
          password: hashedPassword,
          role: role,
          section: section,
          email: user.email || null,
          phone: user.phone || null,
          telegram_id: user.telegram_id || null,
          telegram_username: user.telegram_username || null,
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log(`Added user: ${user.name}, ID: ${user.id}, Role: ${role}, Section: ${section}`);
      } else {
        console.log(`User ${user.name} already exists, skipping.`);
      }
    }
    
    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the import
continueImport().catch(console.error);