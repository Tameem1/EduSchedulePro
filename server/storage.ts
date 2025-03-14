import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { InsertUser, Appointment, QuestionnaireResponse } from "@shared/schema";
import { users, appointments, availabilities, questionnaireResponses, UserRole, AppointmentStatus } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { pool, db } from "./db";

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

  async deleteAvailability(id: number): Promise<void> {
    await db.delete(availabilities).where(eq(availabilities.id, id));
    return;
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

    console.log("Creating appointment with data:", data);

    const newAppointment = await db
      .insert(appointments)
      .values({
        ...data,
        teacherAssignment: data.teacherAssignment || null
      })
      .returning();

    console.log("Created appointment:", newAppointment[0]);
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
      .select({
        id: appointments.id,
        studentId: appointments.studentId,
        teacherId: appointments.teacherId,
        startTime: appointments.startTime,
        status: appointments.status,
        teacherAssignment: appointments.teacherAssignment
      })
      .from(appointments)
      .where(eq(appointments.teacherId, teacherId))
      .orderBy(desc(appointments.startTime));
  },

  async updateAppointment(appointmentId: number, data: any) {
    try {
      console.log("Updating appointment", appointmentId, "with data:", data);

      // Ensure status is defined if present in data
      if (data.status) {
        console.log("Status in update data:", data.status);
        console.log("Valid statuses:", Object.values(AppointmentStatus));
        console.log("Type of status:", typeof data.status);

        // Validate that status is a valid AppointmentStatus value
        if (!Object.values(AppointmentStatus).includes(data.status)) {
          throw new Error(`appointment status '${data.status}' is not defined`);
        }
      }

      // Handle rejection
      if (data.status === AppointmentStatus.REJECTED) {
        console.log("Explicitly handling REJECTED status:", AppointmentStatus.REJECTED);
        try {
          const updatedAppointment = await db
            .update(appointments)
            .set({ 
              status: 'rejected',
              teacherAssignment: data.teacherAssignment || null
            })
            .where(eq(appointments.id, appointmentId))
            .returning();

          console.log("Appointment rejected:", updatedAppointment[0]);
          return updatedAppointment[0];
        } catch (error) {
          console.error("Database error during rejection:", error);
          throw error;
        }
      }

      // Handle accepting an appointment (ASSIGNED status)
      if (data.status === AppointmentStatus.ASSIGNED) {
        console.log("Explicitly handling ASSIGNED status");
        const updatedAppointment = await db
          .update(appointments)
          .set({ 
            status: AppointmentStatus.ASSIGNED,
            teacherAssignment: data.teacherAssignment || null
          })
          .where(eq(appointments.id, appointmentId))
          .returning();

        console.log("Appointment assigned:", updatedAppointment[0]);
        return updatedAppointment[0];
      }

      // If updating status only, handle it directly
      if (data.status && !data.teacherId && !data.responded) {
        console.log("Handling general status update to:", data.status);
        const updatedAppointment = await db
          .update(appointments)
          .set({ 
            status: data.status,
            teacherAssignment: data.teacherAssignment || null
          })
          .where(eq(appointments.id, appointmentId))
          .returning();

        console.log("Updated appointment:", updatedAppointment[0]);
        return updatedAppointment[0];
      }

      // Handle teacher assignment
      if (data.teacherId) {
        const updatedAppointment = await db
          .update(appointments)
          .set({
            teacherId: data.teacherId,
            status: data.status || AppointmentStatus.REQUESTED,
            teacherAssignment: data.teacherAssignment || null
          })
          .where(eq(appointments.id, appointmentId))
          .returning();

        return updatedAppointment[0];
      }

      // Handle response status
      if ('responded' in data) {
        const status = data.responded ? AppointmentStatus.RESPONDED : AppointmentStatus.ASSIGNED;
        const updatedAppointment = await db
          .update(appointments)
          .set({ 
            status,
            teacherAssignment: data.teacherAssignment || null
          })
          .where(eq(appointments.id, appointmentId))
          .returning();

        return updatedAppointment[0];
      }

      // Default update for any other changes
      const updatedAppointment = await db
        .update(appointments)
        .set({
          ...data,
          teacherAssignment: data.teacherAssignment || null
        })
        .where(eq(appointments.id, appointmentId))
        .returning();

      return updatedAppointment[0];
    } catch (error) {
      console.error("Error in updateAppointment:", error);
      throw error;
    }
  },

  async getAppointmentById(appointmentId: number) {
    try {
      console.log(`Fetching appointment with ID: ${appointmentId}`);
      const result = await db
        .select({
          id: appointments.id,
          studentId: appointments.studentId,
          teacherId: appointments.teacherId,
          startTime: appointments.startTime,
          status: appointments.status,
          teacherAssignment: appointments.teacherAssignment
        })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      console.log('Retrieved appointment:', result[0]);
      return result[0];
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw error;
    }
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