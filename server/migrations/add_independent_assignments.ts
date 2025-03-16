import { sql } from "drizzle-orm";
import { db } from "../db";

export async function up() {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS independent_assignments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES users(id),
      completion_time TIMESTAMP NOT NULL,
      assignment TEXT NOT NULL,
      notes TEXT,
      submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );
}

export async function down() {
  await db.execute(
    sql`DROP TABLE IF EXISTS independent_assignments;`
  );
}

export default async function() {
  console.log('Running add_independent_assignments migration...');
  await up();
  console.log('Successfully created independent_assignments table');
}
