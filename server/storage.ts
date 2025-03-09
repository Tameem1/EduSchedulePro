import { IStorage } from "./types";
import {
  User,
  Availability,
  Appointment,
  QuestionnaireResponse,
  InsertUser,
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private availabilities: Map<number, Availability>;
  private appointments: Map<number, Appointment>;
  private questionnaireResponses: Map<number, QuestionnaireResponse>;
  sessionStore: session.Store;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.availabilities = new Map();
    this.appointments = new Map();
    this.questionnaireResponses = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createAvailability(availability: Omit<Availability, "id">): Promise<Availability> {
    const id = this.currentId++;
    const newAvailability = { ...availability, id };
    this.availabilities.set(id, newAvailability);
    return newAvailability;
  }

  async getAvailabilitiesByTeacher(teacherId: number): Promise<Availability[]> {
    return Array.from(this.availabilities.values()).filter(
      (a) => a.teacherId === teacherId
    );
  }

  async createAppointment(appointment: Omit<Appointment, "id">): Promise<Appointment> {
    const id = this.currentId++;
    const newAppointment = { ...appointment, id };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }

  async getAppointmentsByStudent(studentId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      (a) => a.studentId === studentId
    );
  }

  async createQuestionnaireResponse(
    response: Omit<QuestionnaireResponse, "id">
  ): Promise<QuestionnaireResponse> {
    const id = this.currentId++;
    const newResponse = { ...response, id };
    this.questionnaireResponses.set(id, newResponse);
    return newResponse;
  }

  async getQuestionnaireResponse(appointmentId: number): Promise<QuestionnaireResponse | undefined> {
    return Array.from(this.questionnaireResponses.values()).find(
      (r) => r.appointmentId === appointmentId
    );
  }
}

export const storage = new MemStorage();
