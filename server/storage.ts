import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type {
  InsertUser,
  Appointment,
  QuestionnaireResponse,
  IndependentAssignment,
  User,
} from "@shared/schema";
import {
  users,
  appointments,
  availabilities,
  questionnaireResponses,
  UserRole,
  AppointmentStatus,
  independentAssignments,
} from "@shared/schema";
import session from "express-session";
import { pool, db } from "./db";
import connectPgSimple from "connect-pg-simple";

// Helper function to handle database retries
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);

      // If this is a connection error, wait before retrying
      if (error.code === '57P01' || error.code === '08006' || error.code === '08001') {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }
  throw lastError;
}

// Initialize PostgreSQL session store
const PgStore = connectPgSimple(session);

export const storage = {
  sessionStore: new PgStore({
    pool,
    tableName: 'session', // Use a custom session table name
    createTableIfMissing: true, // Create the session table if it doesn't exist
    pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
  }),

  async getUser(id: number) {
    return await withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  },

  async getUserByUsername(username: string) {
    return await withRetry(async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      return user;
    });
  },
  
  async getUserByUsernameAndSection(username: string, section: string) {
    return await withRetry(async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.username, username),
          eq(users.section, section)
        ));
      return user;
    });
  },

  async createUser(user: InsertUser) {
    return await withRetry(async () => {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    });
  },
  
  async updateUser(userId: number, userData: Partial<User>) {
    return await withRetry(async () => {
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, userId))
        .returning();
      return updatedUser;
    });
  },

  async createAvailability(data: any) {
    return await withRetry(async () => {
      const newAvailability = await db
        .insert(availabilities)
        .values(data)
        .returning();
      return newAvailability[0];
    });
  },

  async getAvailabilitiesByTeacher(teacherId: number) {
    return await withRetry(async () => {
      return await db
        .select()
        .from(availabilities)
        .where(eq(availabilities.teacherId, teacherId));
    });
  },

  async deleteAvailability(id: number): Promise<void> {
    return await withRetry(async () => {
      await db.delete(availabilities).where(eq(availabilities.id, id));
      return;
    });
  },

  async createAppointment(data: any) {
    return await withRetry(async () => {
      // Check if the student already has an appointment at the same time
      const existingAppointment = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.studentId, data.studentId),
            eq(appointments.startTime, data.startTime),
          ),
        );

      if (existingAppointment.length > 0) {
        throw new Error("لديك حجز موجود بالفعل في هذا الوقت");
      }

      console.log("Creating appointment with data:", data);

      const newAppointment = await db
        .insert(appointments)
        .values({
          ...data,
        })
        .returning();

      console.log("Created appointment:", newAppointment[0]);
      return newAppointment[0];
    });
  },

  async getAppointmentsByStudent(studentId: number) {
    return await withRetry(async () => {
      return await db
        .select()
        .from(appointments)
        .where(eq(appointments.studentId, studentId))
        .orderBy(desc(appointments.startTime));
    });
  },

  async getAppointmentsByTeacher(teacherId: number) {
    return await withRetry(async () => {
      return await db
        .select({
          id: appointments.id,
          studentId: appointments.studentId,
          teacherId: appointments.teacherId,
          startTime: appointments.startTime,
          status: appointments.status,
          teacherAssignment: appointments.teacherAssignment,
        })
        .from(appointments)
        .where(eq(appointments.teacherId, teacherId))
        .orderBy(desc(appointments.startTime));
    });
  },
  
  async getAppointmentsCreatedByTeacher(teacherUsername: string) {
    return await withRetry(async () => {
      console.log("Searching for appointments with teacherAssignment=", teacherUsername);
      return await db
        .select({
          id: appointments.id,
          studentId: appointments.studentId,
          teacherId: appointments.teacherId,
          startTime: appointments.startTime,
          status: appointments.status,
          teacherAssignment: appointments.teacherAssignment,
        })
        .from(appointments)
        .where(sql`${appointments.teacherAssignment} = ${teacherUsername}`)
        .orderBy(desc(appointments.startTime));
    });
  },

  async updateAppointment(appointmentId: number, data: any) {
    return await withRetry(async () => {
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
          console.log(
            "Explicitly handling REJECTED status:",
            AppointmentStatus.REJECTED,
          );
          try {
            const updatedAppointment = await db
              .update(appointments)
              .set({
                status: "rejected",
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
            })
            .where(eq(appointments.id, appointmentId))
            .returning();

          return updatedAppointment[0];
        }

        // Handle response status
        if ("responded" in data) {
          const status = data.responded
            ? AppointmentStatus.RESPONDED
            : AppointmentStatus.ASSIGNED;
          const updatedAppointment = await db
            .update(appointments)
            .set({
              status,
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
          })
          .where(eq(appointments.id, appointmentId))
          .returning();

        return updatedAppointment[0];
      } catch (error) {
        console.error("Error in updateAppointment:", error);
        throw error;
      }
    });
  },

  async getAppointmentById(appointmentId: number) {
    return await withRetry(async () => {
      try {
        console.log(`Fetching appointment with ID: ${appointmentId}`);
        const result = await db
          .select({
            id: appointments.id,
            studentId: appointments.studentId,
            teacherId: appointments.teacherId,
            startTime: appointments.startTime,
            status: appointments.status,
            teacherAssignment: appointments.teacherAssignment,
          })
          .from(appointments)
          .where(eq(appointments.id, appointmentId));

        console.log("Retrieved appointment:", result[0]);
        return result[0];
      } catch (error) {
        console.error("Error fetching appointment:", error);
        throw error;
      }
    });
  },

  async getAllAppointments() {
    return await withRetry(async () => {
      return await db
        .select()
        .from(appointments)
        .orderBy(desc(appointments.startTime));
    });
  },

  async createQuestionnaireResponse(data: any) {
    return await withRetry(async () => {
      const submissionTime = new Date();
      // Adjust to GMT+3
      submissionTime.setHours(submissionTime.getHours() + 3);

      const newResponse = await db
        .insert(questionnaireResponses)
        .values({
          ...data,
          submittedAt: submissionTime.toISOString()
        })
        .returning();

      return newResponse[0];
    });
  },

  async getQuestionnaireResponse(appointmentId: number) {
    return await withRetry(async () => {
      const result = await db
        .select()
        .from(questionnaireResponses)
        .where(eq(questionnaireResponses.appointmentId, appointmentId));

      return result[0];
    });
  },

  async getAllQuestionnaireResponses() {
    return await withRetry(async () => {
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
          eq(questionnaireResponses.appointmentId, appointments.id),
        )
        .innerJoin(users, eq(appointments.studentId, users.id));
    });
  },
  async createIndependentAssignment(data: any) {
    return await withRetry(async () => {
      const submissionTime = new Date();
      // Adjust to GMT+3
      submissionTime.setHours(submissionTime.getHours() + 3);

      const newAssignment = await db
        .insert(independentAssignments)
        .values({
          ...data,
          submittedAt: submissionTime.toISOString()
        })
        .returning();

      return newAssignment[0];
    });
  },

  async getIndependentAssignments() {
    return await withRetry(async () => {
      return await db
        .select({
          id: independentAssignments.id,
          studentId: independentAssignments.studentId,
          completionTime: independentAssignments.completionTime,
          assignment: independentAssignments.assignment,
          notes: independentAssignments.notes,
          submittedAt: independentAssignments.submittedAt,
          studentName: users.username,
        })
        .from(independentAssignments)
        .innerJoin(users, eq(independentAssignments.studentId, users.id))
        .orderBy(desc(independentAssignments.completionTime));
    });
  },
};