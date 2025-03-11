import { IStorage } from "./types";
import {
  User,
  Availability,
  Appointment,
  QuestionnaireResponse,
  InsertUser,
  users,
  availabilities,
  appointments,
  questionnaireResponses
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import pg from 'pg';

const MemoryStore = createMemoryStore(session);

// Initialize PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser({
    username,
    password,
    role,
    telegramUsername
  }: InsertUser): Promise<User> {
    const inserted = await db
      .insert(users)
      .values({ username, password, role, telegramUsername })
      .returning();
    return inserted[0];
  }

  async createAvailability(availability: Omit<Availability, "id">): Promise<Availability> {
    const [newAvailability] = await db
      .insert(availabilities)
      .values(availability)
      .returning();
    return newAvailability;
  }

  async getAvailabilitiesByTeacher(teacherId: number): Promise<Availability[]> {
    return await db
      .select()
      .from(availabilities)
      .where(eq(availabilities.teacherId, teacherId));
  }

  async createAppointment(appointment: Omit<Appointment, "id">): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        ...appointment,
        status: appointment.status || 'pending'
      })
      .returning();
    return newAppointment;
  }

  async getAppointmentsByStudent(studentId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.studentId, studentId));
  }

  async createQuestionnaireResponse(
    response: Omit<QuestionnaireResponse, "id">
  ): Promise<QuestionnaireResponse> {
    // First get the appointment to ensure it exists
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, response.appointmentId));

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const [newResponse] = await db
      .insert(questionnaireResponses)
      .values(response)
      .returning();
    return newResponse;
  }

  async getQuestionnaireResponse(appointmentId: number): Promise<QuestionnaireResponse | undefined> {
    const [response] = await db
      .select()
      .from(questionnaireResponses)
      .where(eq(questionnaireResponses.appointmentId, appointmentId));
    return response;
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments);
  }

  async updateAppointment(
    id: number,
    data: Partial<Appointment>
  ): Promise<Appointment> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set(data)
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async getAppointmentsByTeacher(teacherId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.teacherId, teacherId));
  }

  async getAllQuestionnaireResponses(): Promise<QuestionnaireResponse[]> {
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

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const results = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    return results[0];
  }

  async getAppointmentById(id: number) {
    const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
}

export const storage = new DatabaseStorage();
import { db } from "./db";
import { users, appointments, availabilities, questionnaireResponses, UserRole } from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { InsertUser, Appointment, QuestionnaireResponse } from "@shared/schema";
import { hash, compare } from "bcrypt";

export const storage = {
  async createUser(user: InsertUser) {
    const { password, ...rest } = user;
    const hashedPassword = await hash(password, 10);
    
    const newUser = await db
      .insert(users)
      .values({ ...rest, password: hashedPassword })
      .returning();
      
    return newUser[0];
  },
  
  async findUserByUsername(username: string) {
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
      
    return userResult[0];
  },
  
  async verifyPassword(user: { password: string }, plainPassword: string) {
    return compare(plainPassword, user.password);
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
      .select()
      .from(questionnaireResponses)
      .leftJoin(appointments, eq(questionnaireResponses.appointmentId, appointments.id));
  }
};
