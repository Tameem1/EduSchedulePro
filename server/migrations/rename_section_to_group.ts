import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration to rename 'section' column to 'group' in users table
 */
export async function up() {
  console.log("Running rename_section_to_group migration (UP)");

  try {
    // First drop the enum constraint on the section column to allow renaming
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN section TYPE TEXT;
    `);

    // Rename the column
    await db.execute(sql`
      ALTER TABLE users 
      RENAME COLUMN section TO "group";
    `);

    // Create the new enum type
    await db.execute(sql`
      CREATE TYPE "group" AS ENUM ('aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud');
    `);

    // Convert the column to use the new enum type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN "group" TYPE "group" USING "group"::text::"group";
    `);

    console.log("Successfully migrated section column to group");
  } catch (error) {
    console.error("Error in rename_section_to_group migration:", error);
    throw error;
  }
}

export async function down() {
  console.log("Running rename_section_to_group migration (DOWN)");

  try {
    // Convert back to text first
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN "group" TYPE TEXT;
    `);

    // Rename the column back
    await db.execute(sql`
      ALTER TABLE users 
      RENAME COLUMN "group" TO section;
    `);

    // Convert back to section enum type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN section TYPE section USING section::text::section;
    `);

    console.log("Successfully reverted group column to section");
  } catch (error) {
    console.error("Error in rename_section_to_group rollback:", error);
    throw error;
  }
}