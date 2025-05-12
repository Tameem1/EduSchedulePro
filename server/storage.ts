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

      // If createdByTeacherId exists in data, it will be included automatically
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
          createdByTeacherId: appointments.createdByTeacherId
        })
        .from(appointments)
        .where(eq(appointments.teacherId, teacherId))
        .orderBy(desc(appointments.startTime));
    });
  },
  
  async getAppointmentsCreatedByTeacher(teacherId: number) {
    return await withRetry(async () => {
      return await db
        .select({
          id: appointments.id,
          studentId: appointments.studentId,
          teacherId: appointments.teacherId,
          startTime: appointments.startTime,
          status: appointments.status,
          teacherAssignment: appointments.teacherAssignment,
          createdByTeacherId: appointments.createdByTeacherId
        })
        .from(appointments)
        .where(eq(appointments.createdByTeacherId, teacherId))
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
        
        // Handle startTime update
        if (data.startTime) {
          console.log("Updating appointment startTime to:", data.startTime);
          
          // If this is an ISO string from datetime-local input, format it appropriately
          // for the database to maintain consistent time representation
          let formattedTime = data.startTime;
          
          // If it's a datetime-local input value (YYYY-MM-DDTHH:MM format)
          if (data.startTime.includes('T') && !data.startTime.includes('Z')) {
            // Create a date object and format it as a standard timestamp
            const dateObj = new Date(data.startTime);
            formattedTime = dateObj.toISOString().slice(0, 19).replace('T', ' ');
            console.log("Formatted time for database:", formattedTime);
          }
          
          const updatedAppointment = await db
            .update(appointments)
            .set({
              startTime: formattedTime,
            })
            .where(eq(appointments.id, appointmentId))
            .returning();
            
          console.log("Appointment time updated:", updatedAppointment[0]);
          return updatedAppointment[0];
        }

        // Check if there are any fields to update
        if (Object.keys(data).length === 0) {
          throw new Error("No update data provided");
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
            createdByTeacherId: appointments.createdByTeacherId,
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
      console.log("Creating questionnaire response with raw data:", data);
      
      // Validate all required fields are present
      if (!data.appointmentId) {
        console.error("Missing appointmentId in questionnaire response data");
        throw new Error("appointmentId is required for questionnaire response");
      }
      
      // Ensure all fields are present with defaults if necessary
      const validatedData = {
        appointmentId: data.appointmentId,
        question1: data.question1 || "نعم",
        question2: data.question2 || "نعم",
        question3: data.question3 || "",
        question4: data.question4 || "",
      };
      
      console.log("Validated questionnaire data:", validatedData);
      
      const submissionTime = new Date();
      // Adjust to GMT+3
      submissionTime.setHours(submissionTime.getHours() + 3);
      
      try {
        console.log("Inserting questionnaire response into database...");
        const newResponse = await db
          .insert(questionnaireResponses)
          .values({
            ...validatedData,
            submittedAt: submissionTime.toISOString()
          })
          .returning();
        
        console.log("Successfully created questionnaire response:", newResponse[0]);
        return newResponse[0];
      } catch (error) {
        console.error("Failed to insert questionnaire response:", error);
        throw error;
      }
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

  async deleteAppointment(appointmentId: number): Promise<void> {
    return await withRetry(async () => {
      await db.delete(appointments).where(eq(appointments.id, appointmentId));
      return;
    });
  },
};