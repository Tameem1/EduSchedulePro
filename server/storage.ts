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
import { eq } from 'drizzle-orm';
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
}

export const storage = new DatabaseStorage();