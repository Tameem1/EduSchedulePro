import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { InsertUser, Appointment, QuestionnaireResponse } from "@shared/schema";
import { users, appointments, availabilities, questionnaireResponses, UserRole } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { pool } from "./db";

const MemoryStore = createMemoryStore(session);

export const storage = {
  sessionStore: new MemoryStore({
    checkPeriod: 86400000,
  }),

  async getUser(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },

  async createUser(user: InsertUser) {
    const newUser = await db
      .insert(users)
      .values(user)
      .returning();

    return newUser[0];
  },

  async verifyPassword(user: { password: string }, plainPassword: string) {
    // This will be handled by auth.ts using crypto module
    return true;
  },

  async createAvailability(data: any) {
    const newAvailability = await db
      .insert(availabilities)
      .values(data)
      .returning();

    return newAvailability[0];
  },

  async getAvailabilitiesByTeacher(teacherId: number) {
    return await db
      .select()
      .from(availabilities)
      .where(eq(availabilities.teacherId, teacherId));
  },

  async createAppointment(data: any) {
    // Check if the student already has an appointment at the same time
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.studentId, data.studentId),
          eq(appointments.startTime, data.startTime)
        )
      );

    if (existingAppointment.length > 0) {
      throw new Error("لديك حجز موجود بالفعل في هذا الوقت");
    }

    const newAppointment = await db
      .insert(appointments)
      .values(data)
      .returning();

    return newAppointment[0];
  },

  async getAppointmentsByStudent(studentId: number) {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.studentId, studentId))
      .orderBy(desc(appointments.startTime));
  },

  async getAppointmentsByTeacher(teacherId: number) {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.teacherId, teacherId))
      .orderBy(desc(appointments.startTime));
  },

  async updateAppointment(appointmentId: number, data: any) {
    const updatedAppointment = await db
      .update(appointments)
      .set(data)
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updatedAppointment[0];
  },

  async getAppointmentById(appointmentId: number) {
    const result = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));

    return result[0];
  },

  async getAllAppointments() {
    return await db
      .select()
      .from(appointments)
      .orderBy(desc(appointments.startTime));
  },

  async createQuestionnaireResponse(data: any) {
    const newResponse = await db
      .insert(questionnaireResponses)
      .values(data)
      .returning();

    return newResponse[0];
  },

  async getQuestionnaireResponse(appointmentId: number) {
    const result = await db
      .select()
      .from(questionnaireResponses)
      .where(eq(questionnaireResponses.appointmentId, appointmentId));

    return result[0];
  },

  async getAllQuestionnaireResponses() {
    return await db
      .select({
        id: questionnaireResponses.id,
        appointmentId: questionnaireResponses.appointmentId,
        question1: questionnaireResponses.question1,
        question2: questionnaireResponses.question2,
        question3: questionnaireResponses.question3,
        question4: questionnaireResponses.question4,
        teacherId: appointments.teacherId,
        studentId: appointments.studentId,
        createdAt: appointments.startTime,
        studentName: users.username,
      })
      .from(questionnaireResponses)
      .innerJoin(
        appointments,
        eq(questionnaireResponses.appointmentId, appointments.id)
      )
      .innerJoin(
        users,
        eq(appointments.studentId, users.id)
      );
  }
};