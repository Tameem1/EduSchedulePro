import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define enums using pgEnum
export const userRoleEnum = pgEnum('user_role', ['student', 'teacher', 'manager']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['pending', 'matched', 'completed']);

// Export const values for use in the application
export const UserRole = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  MANAGER: 'manager'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// User table with role enum
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull(),
  telegramId: text("telegram_id")
});

// Teacher availability slots
export const availabilities = pgTable("availabilities", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull()
});

// Appointments between students and teachers
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  teacherId: integer("teacher_id").references(() => users.id), 
  startTime: timestamp("start_time").notNull(),
  status: appointmentStatusEnum("status").notNull().default('pending')
});

// Questionnaire responses for appointments
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  question1: text("question1").notNull(),
  question2: text("question2").notNull(),
  question3: text("question3").notNull(),
  question4: text("question4").notNull()
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  teacherAvailabilities: many(availabilities),
  teacherAppointments: many(appointments, { relationName: "teacherAppointments" }),
  studentAppointments: many(appointments, { relationName: "studentAppointments" })
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  student: one(users, {
    fields: [appointments.studentId],
    references: [users.id],
    relationName: "studentAppointments"
  }),
  teacher: one(users, {
    fields: [appointments.teacherId],
    references: [users.id],
    relationName: "teacherAppointments"
  }),
  questionnaireResponse: many(questionnaireResponses)
}));

export const availabilitiesRelations = relations(availabilities, ({ one }) => ({
  teacher: one(users, {
    fields: [availabilities.teacherId],
    references: [users.id]
  })
}));

export const questionnaireResponsesRelations = relations(questionnaireResponses, ({ one }) => ({
  appointment: one(appointments, {
    fields: [questionnaireResponses.appointmentId],
    references: [appointments.id]
  })
}));

// Create Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertAvailabilitySchema = createInsertSchema(availabilities);
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ teacherId: true });
export const insertQuestionnaireSchema = createInsertSchema(questionnaireResponses);

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type Appointment = typeof appointments.$inferSelect & {
  student?: User;
  teacher?: User;
};
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;