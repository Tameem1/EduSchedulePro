
import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  console.log("Running rename_group_to_section migration (UP)");

  try {
    // First convert the group column to text type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN "group" TYPE TEXT;
    `);

    // Rename the column from group to section
    await db.execute(sql`
      ALTER TABLE users 
      RENAME COLUMN "group" TO section;
    `);

    // Create the section enum type
    await db.execute(sql`
      CREATE TYPE "section" AS ENUM ('aasem', 'khaled', 'mmdoh', 'obada', 'awab', 'zuhair', 'yahia', 'omar', 'motaa', 'mahmoud');
    `);

    // Convert the column to use the section enum type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN section TYPE section USING section::text::section;
    `);

    console.log("Successfully renamed group column to section");
  } catch (error) {
    console.error("Error in rename_group_to_section migration:", error);
    throw error;
  }
}

export async function down() {
  console.log("Running rename_group_to_section migration (DOWN)");

  try {
    // Convert back to text first
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN section TYPE TEXT;
    `);

    // Rename the column back to group
    await db.execute(sql`
      ALTER TABLE users 
      RENAME COLUMN section TO "group";
    `);

    // Convert back to group enum type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN "group" TYPE "group" USING "group"::text::"group";
    `);

    console.log("Successfully reverted section column to group");
  } catch (error) {
    console.error("Error in rename_group_to_section rollback:", error);
    throw error;
  }
}
