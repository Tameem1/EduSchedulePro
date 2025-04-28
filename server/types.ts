import type { Request } from "express";
import type { Store } from "express-session";
import type { User, Availability, Appointment, QuestionnaireResponse, InsertUser } from "@shared/schema";

export interface IStorage {
  sessionStore: Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameAndSection(username: string, section: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, userData: Partial<User>): Promise<User>;
  createAvailability(availability: Omit<Availability, "id">): Promise<Availability>;
  getAvailabilitiesByTeacher(teacherId: number): Promise<Availability[]>;
  deleteAvailability(id: number): Promise<void>;
  createAppointment(appointment: Omit<Appointment, "id">): Promise<Appointment>;
  getAppointmentsByStudent(studentId: number): Promise<Appointment[]>;
  getAppointmentsByTeacher(teacherId: number): Promise<Appointment[]>;
  getAppointmentsCreatedByTeacher(teacherUsername: string): Promise<Appointment[]>;
  getAppointmentById(appointmentId: number): Promise<Appointment | undefined>;
  updateAppointment(appointmentId: number, data: any): Promise<Appointment>;
  getAllAppointments(): Promise<Appointment[]>;
  createQuestionnaireResponse(response: Omit<QuestionnaireResponse, "id">): Promise<QuestionnaireResponse>;
  getQuestionnaireResponse(appointmentId: number): Promise<QuestionnaireResponse | undefined>;
  getAllQuestionnaireResponses(): Promise<QuestionnaireResponse[]>;
  createIndependentAssignment(data: any): Promise<any>;
  getIndependentAssignments(): Promise<any[]>;
}
