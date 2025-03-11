
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { InsertUser, Appointment, QuestionnaireResponse } from "@shared/schema";
import { users, appointments, availabilities, questionnaireResponses, UserRole } from "@shared/schema";
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

    const newAppointment = await db
      .insert(appointments)
      .values(data)
      .returning();

    return newAppointment[0];
  },

  async getAppointmentsByStudent(studentId: number) {
    const results = await db
      .select({
        id: appointments.id,
        studentId: appointments.studentId,
        teacherId: appointments.teacherId,
        startTime: appointments.startTime,
        status: appointments.status,
        studentName: users.username,
      })
      .from(appointments)
      .where(eq(appointments.studentId, studentId))
      .orderBy(desc(appointments.startTime))
      .leftJoin(users, eq(appointments.studentId, users.id));

    // Get teacher names in a second query
    const appointmentIds = results.map(app => app.id);
    const teacherInfo = appointmentIds.length ? await db
      .select({
        appointmentId: appointments.id,
        teacherName: users.username,
      })
      .from(appointments)
      .where(eq(appointments.id, sql`ANY(${appointmentIds})`))
      .leftJoin(users, eq(appointments.teacherId, users.id)) : [];

    // Combine the results
    return results.map(app => {
      const teacherData = teacherInfo.find(t => t.appointmentId === app.id);
      return {
        ...app,
        teacher: app.teacherId ? { 
          id: app.teacherId, 
          username: teacherData?.teacherName || `معلم #${app.teacherId}` 
        } : undefined,
        student: { 
          id: app.studentId, 
          username: app.studentName || `طالب #${app.studentId}` 
        }
      };
    });
  },

  async getAppointmentsByTeacher(teacherId: number) {
    const results = await db
      .select({
        id: appointments.id,
        studentId: appointments.studentId,
        teacherId: appointments.teacherId,
        startTime: appointments.startTime,
        status: appointments.status,
        teacherName: users.username,
      })
      .from(appointments)
      .where(eq(appointments.teacherId, teacherId))
      .orderBy(desc(appointments.startTime))
      .leftJoin(users, eq(appointments.teacherId, users.id));

    // Get student names in a second query
    const appointmentIds = results.map(app => app.id);
    const studentInfo = appointmentIds.length ? await db
      .select({
        appointmentId: appointments.id,
        studentName: users.username,
      })
      .from(appointments)
      .where(eq(appointments.id, sql`ANY(${appointmentIds})`))
      .leftJoin(users, eq(appointments.studentId, users.id)) : [];

    // Combine the results
    return results.map(app => {
      const studentData = studentInfo.find(s => s.appointmentId === app.id);
      return {
        ...app,
        teacher: { 
          id: app.teacherId, 
          username: app.teacherName || `معلم #${app.teacherId}` 
        },
        student: app.studentId ? { 
          id: app.studentId, 
          username: studentData?.studentName || `طالب #${app.studentId}` 
        } : undefined
      };
    });
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
    // First get the appointment
    const [appointmentResult] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));

    if (!appointmentResult) {
      return null;
    }

    // Get student info
    const [student] = appointmentResult.studentId ? 
      await db.select().from(users).where(eq(users.id, appointmentResult.studentId)) : [];

    // Get teacher info
    const [teacher] = appointmentResult.teacherId ?
      await db.select().from(users).where(eq(users.id, appointmentResult.teacherId)) : [];

    return {
      ...appointmentResult,
      student: student ? { 
        id: student.id, 
        username: student.username 
      } : undefined,
      teacher: teacher ? { 
        id: teacher.id, 
        username: teacher.username 
      } : undefined
    };
  },

  async getAllAppointments() {
    // First get all appointments
    const appointmentsResult = await db
      .select()
      .from(appointments)
      .orderBy(desc(appointments.startTime));

    // Get all student IDs and teacher IDs
    const studentIds = appointmentsResult.map(app => app.studentId).filter(Boolean);
    const teacherIds = appointmentsResult.map(app => app.teacherId).filter(Boolean);
    
    // Get all relevant users in one query
    const allUserIds = [...new Set([...studentIds, ...teacherIds])];
    const userInfo = allUserIds.length ? await db
      .select()
      .from(users)
      .where(eq(users.id, sql`ANY(${allUserIds})`)) : [];

    // Create a map for quick lookup
    const userMap = new Map();
    userInfo.forEach(user => userMap.set(user.id, user));

    // Combine the results
    return appointmentsResult.map(app => {
      const studentUser = app.studentId && userMap.get(app.studentId);
      const teacherUser = app.teacherId && userMap.get(app.teacherId);
      
      return {
        ...app,
        student: studentUser ? { 
          id: studentUser.id, 
          username: studentUser.username 
        } : { id: app.studentId, username: `طالب #${app.studentId}` },
        teacher: teacherUser ? { 
          id: teacherUser.id, 
          username: teacherUser.username 
        } : app.teacherId ? { id: app.teacherId, username: `معلم #${app.teacherId}` } : undefined
      };
    });
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
    // First get all questionnaire responses with appointment IDs
    const responses = await db
      .select({
        id: questionnaireResponses.id,
        appointmentId: questionnaireResponses.appointmentId,
        question1: questionnaireResponses.question1,
        question2: questionnaireResponses.question2,
        question3: questionnaireResponses.question3,
        question4: questionnaireResponses.question4,
      })
      .from(questionnaireResponses);

    // Get all appointments referenced by the questionnaires
    const appointmentIds = responses.map(r => r.appointmentId);
    const appointmentsInfo = appointmentIds.length ? await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, sql`ANY(${appointmentIds})`)) : [];

    // Get all student and teacher IDs
    const studentIds = appointmentsInfo.map(app => app.studentId).filter(Boolean);
    const teacherIds = appointmentsInfo.map(app => app.teacherId).filter(Boolean);
    
    // Get all users in one query
    const allUserIds = [...new Set([...studentIds, ...teacherIds])];
    const usersInfo = allUserIds.length ? await db
      .select()
      .from(users)
      .where(eq(users.id, sql`ANY(${allUserIds})`)) : [];

    // Create maps for quick lookup
    const appointmentMap = new Map();
    appointmentsInfo.forEach(app => appointmentMap.set(app.id, app));
    
    const userMap = new Map();
    usersInfo.forEach(user => userMap.set(user.id, user));

    // Combine the results
    return responses.map(response => {
      const appointment = appointmentMap.get(response.appointmentId);
      if (!appointment) return response;

      const student = appointment.studentId && userMap.get(appointment.studentId);
      const teacher = appointment.teacherId && userMap.get(appointment.teacherId);

      return {
        ...response,
        teacherId: appointment.teacherId,
        studentId: appointment.studentId,
        createdAt: appointment.startTime,
        studentName: student ? student.username : `طالب #${appointment.studentId}`,
        teacherName: teacher ? teacher.username : appointment.teacherId ? `معلم #${appointment.teacherId}` : 'غير معين'
      };
    });
  }
};
