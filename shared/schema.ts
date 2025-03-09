import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const UserRole = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  MANAGER: 'manager'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: Object.values(UserRole) }).notNull()
});

export const availabilities = pgTable("availabilities", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull()
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  teacherId: integer("teacher_id"),
  startTime: timestamp("start_time").notNull(),
  status: text("status", { enum: ['pending', 'matched', 'completed'] }).notNull()
});

export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull(),
  question1: text("question1").notNull(),
  question2: text("question2").notNull(),
  question3: text("question3").notNull(),
  question4: text("question4").notNull()
});

export const insertUserSchema = createInsertSchema(users);
export const insertAvailabilitySchema = createInsertSchema(availabilities);
export const insertAppointmentSchema = createInsertSchema(appointments);
export const insertQuestionnaireSchema = createInsertSchema(questionnaireResponses);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;
