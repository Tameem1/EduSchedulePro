import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  pgEnum,
  unique,
  varchar,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define enums using pgEnum
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "teacher",
  "manager",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "requested",
  "assigned",
  "responded",
  "done",
  "rejected",
  "not_attended",
]);

// Export const values for use in the application - make sure these match exactly with the enum values
export const AppointmentStatus = {
  PENDING: "pending",
  REQUESTED: "requested",
  ASSIGNED: "assigned",
  RESPONDED: "responded",
  DONE: "done",
  REJECTED: "rejected",
  NOT_ATTENDED: "not_attended",
} as const;

export const AppointmentStatusArabic = {
  pending: "قيد الانتظار",
  requested: "تم الطلب",
  assigned: "تم التعيين",
  responded: "تمت الاستجابة",
  done: "مكتمل",
  rejected: "مرفوض",
  not_attended: "لم يحضر",
} as const;

export const Section = {
  AASEM: "aasem",
  KHALED: "khaled",
  MMDOH: "mmdoh",
  OBADA: "obada",
  AWAB: "awab",
  ZUHAIR: "zuhair",
  YAHIA: "yahia",
  OMAR: "omar",
  MOTAA: "motaa",
  MAHMOUD: "mahmoud",
  KIBAR: "kibar",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];
export type AppointmentStatusType =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
export type SectionType = (typeof Section)[keyof typeof Section];

// User table with role enum
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    password: text("password").notNull(),
    role: userRoleEnum("role").notNull(),
    telegramUsername: text("telegram_username"),
    telegramId: varchar("telegram_id"),
    section: text("section"), // Optional section field as text to support any values
  },
  (table) => {
    return {
      // Make username unique only within a section
      usernameUniqueInSection: unique().on(table.username, table.section),
    };
  },
);

// Add session table definition
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { mode: "string" }).notNull(),
});

// Teacher availability slots
export const availabilities = pgTable("availabilities", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .references(() => users.id)
    .notNull(),
  startTime: timestamp("start_time", { mode: "string" }).notNull(),
  endTime: timestamp("end_time", { mode: "string" }).notNull(),
});

// Appointments between students and teachers
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),
  teacherId: integer("teacher_id").references(() => users.id),
  startTime: timestamp("start_time", { mode: "string" }).notNull(),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  teacherAssignment: text("teacherAssignment"),
  createdByTeacherId: integer("created_by_teacher_id").references(
    () => users.id,
  ),
});

// Questionnaire responses for appointments
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .references(() => appointments.id)
    .notNull(),
  question1: text("question1").notNull(),
  question2: text("question2").notNull(),
  question3: text("question3").notNull(),
  question4: text("question4").notNull(),
  submittedAt: timestamp("submitted_at", { mode: "string" })
    .defaultNow()
    .notNull(),
});

// New table for independent assignments
export const independentAssignments = pgTable("independent_assignments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id)
    .notNull(),
  completionTime: timestamp("completion_time", { mode: "string" }).notNull(),
  assignment: text("assignment").notNull(),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { mode: "string" })
    .defaultNow()
    .notNull(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  teacherAvailabilities: many(availabilities),
  teacherAppointments: many(appointments, {
    relationName: "teacherAppointments",
  }),
  studentAppointments: many(appointments, {
    relationName: "studentAppointments",
  }),
  createdAppointments: many(appointments, {
    relationName: "createdAppointments",
  }),
}));

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    student: one(users, {
      fields: [appointments.studentId],
      references: [users.id],
      relationName: "studentAppointments",
    }),
    teacher: one(users, {
      fields: [appointments.teacherId],
      references: [users.id],
      relationName: "teacherAppointments",
    }),
    createdByTeacher: one(users, {
      fields: [appointments.createdByTeacherId],
      references: [users.id],
      relationName: "createdAppointments",
    }),
    questionnaireResponse: many(questionnaireResponses),
  }),
);

export const availabilitiesRelations = relations(availabilities, ({ one }) => ({
  teacher: one(users, {
    fields: [availabilities.teacherId],
    references: [users.id],
  }),
}));

export const questionnaireResponsesRelations = relations(
  questionnaireResponses,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [questionnaireResponses.appointmentId],
      references: [appointments.id],
    }),
  }),
);

// Add relations for independent assignments
export const independentAssignmentsRelations = relations(
  independentAssignments,
  ({ one }) => ({
    student: one(users, {
      fields: [independentAssignments.studentId],
      references: [users.id],
    }),
  }),
);

// Modified Zod schemas for validation with GMT+3 handling
export const insertUserSchema = createInsertSchema(users);
export const insertAvailabilitySchema = createInsertSchema(
  availabilities,
).extend({
  // Ensure we use the exact time strings provided without any transformation
  startTime: z.string().transform((str) => str),
  endTime: z.string().transform((str) => str),
});
export const insertAppointmentSchema = createInsertSchema(appointments)
  .extend({
    // Ensure we use the exact time string provided without any transformation
    startTime: z.string().transform((str) => str),
    teacherAssignment: z.string().optional(),
    createdByTeacherId: z.number().optional(),
  })
  .omit({ teacherId: true });
export const insertQuestionnaireSchema = createInsertSchema(
  questionnaireResponses,
)
  .extend({
    // Convert the timestamp to GMT+3 before storing
    submittedAt: z
      .string()
      .optional()
      .transform((str) => {
        if (!str) return undefined;
        const date = new Date(str);
        // Adjust to GMT+3
        date.setHours(date.getHours() + 3);
        return date.toISOString();
      }),
  })
  .omit({
    id: true,
  });

// Add new insert schema for independent assignments
export const insertIndependentAssignmentSchema = createInsertSchema(
  independentAssignments,
)
  .extend({
    completionTime: z.string().transform((str) => str),
  })
  .omit({
    id: true,
    submittedAt: true,
  });

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type Appointment = typeof appointments.$inferSelect & {
  student?: User;
  teacher?: User;
};
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;
export type IndependentAssignment = typeof independentAssignments.$inferSelect;

export const UserRole = {
  STUDENT: "student",
  TEACHER: "teacher",
  MANAGER: "manager",
} as const;
