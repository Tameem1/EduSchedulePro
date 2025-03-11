import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAppointmentSchema, insertAvailabilitySchema, insertQuestionnaireSchema } from "@shared/schema";
import { db } from "./db";
import { eq } from 'drizzle-orm';
import { users, availabilities } from "@shared/schema";
import { sendTelegramNotification, notifyTeacherAboutAppointment } from "./telegram"; // Import the Telegram notification functions
import { startOfDay, endOfDay } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // New endpoint to fetch all teachers
  app.get("/api/users/teachers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const teachers = await db.select().from(users).where(eq(users.role, "teacher"));
      res.json(teachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      res.status(500).json({ error: "Failed to fetch teachers" });
    }
  });

  // New endpoint to fetch all availabilities
  app.get("/api/availabilities", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const allAvailabilities = await db.select().from(availabilities);

      // Get today's date at midnight in GMT+3
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter availabilities for today only
      const todayAvailabilities = allAvailabilities.filter(availability => {
        const availabilityStartDate = new Date(availability.startTime);
        const availabilityEndDate = new Date(availability.endTime);
        return availabilityStartDate >= todayStart && availabilityEndDate <= todayEnd;
      });

      res.json(todayAvailabilities);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      res.status(500).json({ error: "Failed to fetch availabilities" });
    }
  });

  // Teacher routes
  app.post("/api/availabilities", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized: User not authenticated");
      return res.sendStatus(401);
    }

    if (req.user.role !== "teacher") {
      console.log(`Forbidden: User role is ${req.user.role}, expected 'teacher'`);
      return res.sendStatus(403);
    }

    try {
      const { startTime, endTime } = req.body;
      console.log("Creating availability for teacher:", req.user.id, "with data:", {
        startTime,
        endTime,
        teacherId: req.user.id
      });

      // Pass the ISO strings directly without converting to Date objects
      const parsedData = insertAvailabilitySchema.parse({
        startTime,
        endTime,
        teacherId: req.user.id,
      });

      const availability = await storage.createAvailability(parsedData);
      console.log("Created availability:", availability);
      res.json(availability);
    } catch (error) {
      console.error("Error creating availability:", error);
      res.status(400).json({ error: "Invalid availability data" });
    }
  });

  app.get("/api/teachers/:id/availabilities", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized: User not authenticated");
      return res.sendStatus(401);
    }

    try {
      const teacherId = parseInt(req.params.id);
      console.log("Fetching availabilities for teacher:", teacherId);
      const teacherAvailabilities = await storage.getAvailabilitiesByTeacher(teacherId);

      // Get today's date at midnight in GMT+3
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter availabilities for today only
      const todayAvailabilities = teacherAvailabilities.filter(availability => {
        const availabilityStartDate = new Date(availability.startTime);
        const availabilityEndDate = new Date(availability.endTime);
        return availabilityStartDate >= todayStart && availabilityEndDate <= todayEnd;
      });

      console.log("Found availabilities:", todayAvailabilities);
      res.json(todayAvailabilities);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      res.status(500).json({ error: "Failed to fetch availabilities" });
    }
  });

  // Student routes
  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    if (req.user.role !== "student") {
      return res.sendStatus(403);
    }

    try {
      const { startTime } = req.body;
      console.log(`Appointment requested for time: ${startTime}`);

      const parsedData = insertAppointmentSchema.parse({
        startTime,
        studentId: req.user.id,
        status: "pending"
      });

      const appointment = await storage.createAppointment(parsedData);
      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);

      // Check if it's a duplicate appointment error
      if (error instanceof Error && error.message === "لديك حجز موجود بالفعل في هذا الوقت") {
        return res.status(409).json({ error: error.message });
      }

      res.status(400).json({ error: "Invalid appointment data" });
    }
  });

  app.get("/api/students/:id/appointments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const studentId = parseInt(req.params.id);
      const appointments = await storage.getAppointmentsByStudent(studentId);

      // Get today's date at midnight in GMT+3.  Note:  This assumes GMT+3 is the correct timezone.  Adjust as needed.
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter appointments for today only, considering GMT+3
      const todayAppointments = appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.startTime);
        return appointmentDate >= todayStart && appointmentDate <= todayEnd;
      });

      res.json(todayAppointments);

    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Questionnaire routes
  app.post("/api/questionnaire-responses", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    try {
      const parsedData = insertQuestionnaireSchema.parse(req.body);

      // Update appointment status to completed
      await storage.updateAppointment(parsedData.appointmentId, {
        status: "completed"
      });

      // Create questionnaire response
      const response = await storage.createQuestionnaireResponse(parsedData);
      res.json(response);
    } catch (error) {
      console.error("Error creating questionnaire response:", error);
      res.status(400).json({ error: "Invalid questionnaire data" });
    }
  });

  app.get("/api/appointments/:id/questionnaire", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      const response = await storage.getQuestionnaireResponse(appointmentId);
      res.json(response);
    } catch (error) {
      console.error("Error fetching questionnaire:", error);
      res.status(500).json({ error: "Failed to fetch questionnaire" });
    }
  });

  // New endpoint to get all appointments
  app.get("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      const allAppointments = await storage.getAllAppointments();
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter appointments for today only
      const todayAppointments = allAppointments.filter(appointment => {
        const appointmentDate = new Date(appointment.startTime);
        return appointmentDate >= todayStart && appointmentDate <= todayEnd;
      });

      res.json(todayAppointments);

    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Get a single appointment by ID
  app.get("/api/appointments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointmentById(appointmentId);

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  // New endpoint to assign teacher to appointment WITH TELEGRAM NOTIFICATION
  app.patch("/api/appointments/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      const { teacherId, status } = req.body;

      const appointment = await storage.updateAppointment(appointmentId, {
        teacherId,
        status
      });

      // Send Telegram notification after successful update
      let notificationSent = false;
      if (teacherId) {
        notificationSent = await notifyTeacherAboutAppointment(appointmentId, teacherId);
      }

      // Return the appointment along with notification status
      res.json({
        ...appointment,
        notificationSent
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  // Get teacher's appointments
  app.get("/api/teachers/:id/appointments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    try {
      const teacherId = parseInt(req.params.id);
      const appointments = await storage.getAppointmentsByTeacher(teacherId);
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter appointments for today only
      const todayAppointments = appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.startTime);
        return appointmentDate >= todayStart && appointmentDate <= todayEnd;
      });

      res.json(todayAppointments);

    } catch (error) {
      console.error("Error fetching teacher appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Get all questionnaire responses
  app.get("/api/questionnaire-responses", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      const responses = await storage.getAllQuestionnaireResponses();
      res.json(responses);
    } catch (error) {
      console.error("Error fetching questionnaire responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}