// server/migrations/add_teacherAssignment.ts

import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  // Adds a new nullable TEXT column called "teacherAssignment" to the "appointments" table
  await db.execute(
    sql`ALTER TABLE appointments ADD COLUMN "teacherAssignment" text;`,
  );
}

export async function down() {
  // Drops the "teacherAssignment" column if you need to roll back the migration
  await db.execute(
    sql`ALTER TABLE appointments DROP COLUMN "teacherAssignment";`,
  );
}
