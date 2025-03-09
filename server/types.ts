import type { Request } from "express";
import type { Store } from "express-session";
import type { User, Availability, Appointment, QuestionnaireResponse, InsertUser } from "@shared/schema";

export interface IStorage {
  sessionStore: Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAvailability(availability: Omit<Availability, "id">): Promise<Availability>;
  getAvailabilitiesByTeacher(teacherId: number): Promise<Availability[]>;
  createAppointment(appointment: Omit<Appointment, "id">): Promise<Appointment>;
  getAppointmentsByStudent(studentId: number): Promise<Appointment[]>;
  createQuestionnaireResponse(response: Omit<QuestionnaireResponse, "id">): Promise<QuestionnaireResponse>;
  getQuestionnaireResponse(appointmentId: number): Promise<QuestionnaireResponse | undefined>;
}
