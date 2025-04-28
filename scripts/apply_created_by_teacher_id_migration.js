import { up } from '../server/migrations/add_created_by_teacher_id.js';

async function applyMigration() {
  console.log('Applying migration to add created_by_teacher_id to appointments table');
  
  try {
    const result = await up();
    
    if (result) {
      console.log('Migration completed successfully');
    } else {
      console.error('Migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('Migration process complete');
  process.exit(0);
});