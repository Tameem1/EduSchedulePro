import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import {
  insertAppointmentSchema,
  insertAvailabilitySchema,
  insertQuestionnaireSchema,
  AppointmentStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, availabilities } from "@shared/schema";
import {
  sendTelegramNotification,
  notifyTeacherAboutAppointment,
} from "./telegram";
import { startOfDay, endOfDay } from "date-fns";
import { addHours } from "date-fns";

// Keep track of all connected clients
const clients = new Set<WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create WebSocket server before setting up auth
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    verifyClient: (info, cb) => {
      // Allow all WebSocket connections without authentication
      console.log(
        "New WebSocket connection attempt from:",
        info.req.headers.origin,
      );
      cb(true);
    },
  });

  // Set up WebSocket connection handling
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected successfully");
    clients.add(ws);

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: "connection", status: "connected" }));

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    ws.on("close", (code, reason) => {
      console.log("WebSocket client disconnected", {
        code,
        reason: reason.toString(),
      });
      clients.delete(ws);
    });

    // Heartbeat to keep connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on("pong", () => {
      // Client responded to ping, connection is alive
    });

    ws.on("close", () => {
      clearInterval(interval);
    });
  });

  // Helper function to broadcast updates with error handling
  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    console.log(`Broadcasting ${type} update to ${clients.size} clients`);

    clients.forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      } catch (error) {
        console.error("Error broadcasting message:", error);
        // Remove dead connections
        clients.delete(client);
      }
    });
  };

  // Setup auth after WebSocket server
  setupAuth(app);

  // Add new endpoint to get all students
  app.get("/api/users/students", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const students = await db
        .select()
        .from(users)
        .where(eq(users.role, "student"));
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // New endpoint to fetch all teachers
  app.get("/api/users/teachers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const teachers = await db
        .select()
        .from(users)
        .where(eq(users.role, "teacher"));
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
      const todayAvailabilities = allAvailabilities.filter((availability) => {
        const availabilityStartDate = new Date(availability.startTime);
        const availabilityEndDate = new Date(availability.endTime);
        return (
          availabilityStartDate >= todayStart && availabilityEndDate <= todayEnd
        );
      });

      res.json(todayAvailabilities);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      res.status(500).json({ error: "Failed to fetch availabilities" });
    }
  });

  // Create availability endpoint
  app.post("/api/availabilities", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized: User not authenticated");
      return res.sendStatus(401);
    }

    if (req.user.role !== "teacher") {
      console.log(
        `Forbidden: User role is ${req.user.role}, expected 'teacher'`,
      );
      return res.sendStatus(403);
    }

    try {
      const { startTime, endTime } = req.body;
      console.log(
        "Creating availability for teacher:",
        req.user.id,
        "with data:",
        {
          startTime,
          endTime,
          teacherId: req.user.id,
        },
      );

      const parsedData = insertAvailabilitySchema.parse({
        startTime,
        endTime,
        teacherId: req.user.id,
      });

      const availability = await storage.createAvailability(parsedData);
      console.log("Created availability:", availability);

      // Broadcast the new availability
      broadcastUpdate("availabilityUpdate", { action: "create", availability });

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
      const teacherAvailabilities =
        await storage.getAvailabilitiesByTeacher(teacherId);

      // Get today's date at midnight in GMT+3
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // Filter availabilities for today only
      const todayAvailabilities = teacherAvailabilities.filter(
        (availability) => {
          const availabilityStartDate = new Date(availability.startTime);
          const availabilityEndDate = new Date(availability.endTime);
          return (
            availabilityStartDate >= todayStart &&
            availabilityEndDate <= todayEnd
          );
        },
      );

      console.log("Found availabilities:", todayAvailabilities);
      res.json(todayAvailabilities);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      res.status(500).json({ error: "Failed to fetch availabilities" });
    }
  });

  // Delete availability endpoint
  app.delete("/api/availabilities/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    if (req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    try {
      const availabilityId = parseInt(req.params.id);

      // Fetch the availability to check if it belongs to the requesting teacher
      const teacherAvailabilities = await storage.getAvailabilitiesByTeacher(
        req.user.id,
      );
      const availability = teacherAvailabilities.find(
        (a) => a.id === availabilityId,
      );

      if (!availability) {
        return res
          .status(404)
          .json({
            error:
              "Availability not found or you don't have permission to delete it",
          });
      }

      await storage.deleteAvailability(availabilityId);
      console.log(`Deleted availability with ID ${availabilityId}`);

      // Broadcast the deletion
      broadcastUpdate("availabilityUpdate", {
        action: "delete",
        availabilityId,
      });

      res.status(200).json({ message: "Availability deleted successfully" });
    } catch (error) {
      console.error("Error deleting availability:", error);
      res.status(500).json({ error: "Failed to delete availability" });
    }
  });

  // Student routes
  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    if (
      req.user.role !== "student" &&
      req.user.role !== "teacher" &&
      req.user.role !== "manager"
    ) {
      return res.sendStatus(403);
    }

    try {
      const { startTime, studentId, teacherAssignment } = req.body;
      console.log(`Appointment requested with data:`, {
        startTime,
        studentId,
        teacherAssignment,
      });

      const parsedData = insertAppointmentSchema.parse({
        startTime,
        studentId: studentId || req.user.id, // Use provided studentId or user's id if not provided
        status: "pending",
        teacherAssignment, // Include teacherAssignment in parsed data
      });

      const appointment = await storage.createAppointment(parsedData);

      // Broadcast the new appointment
      broadcastUpdate("appointmentUpdate", { action: "create", appointment });

      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);

      // Check if it's a duplicate appointment error
      if (
        error instanceof Error &&
        error.message === "لديك حجز موجود بالفعل في هذا الوقت"
      ) {
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
      const todayAppointments = appointments.filter((appointment) => {
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

      // Update appointment status to done
      const appointment = await storage.updateAppointment(
        parsedData.appointmentId,
        {
          status: AppointmentStatus.DONE,
        },
      );

      // Create questionnaire response
      const response = await storage.createQuestionnaireResponse(parsedData);

      // Broadcast the update
      broadcastUpdate("appointmentUpdate", { action: "update", appointment });

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
      console.log("Fetching all appointments");
      const allAppointments = await storage.getAllAppointments();

      if (!allAppointments) {
        console.log("No appointments found");
        return res.json([]);
      }

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      console.log("Filtering appointments for today between:", {
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
      });

      // Filter appointments for today only
      const todayAppointments = allAppointments.filter((appointment) => {
        const appointmentDate = new Date(appointment.startTime);
        return appointmentDate >= todayStart && appointmentDate <= todayEnd;
      });

      console.log(`Found ${todayAppointments.length} appointments for today`);
      res.json(todayAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to fetch appointments",
        details: errorMessage,
      });
    }
  });

  // Get a single appointment by ID
  app.get("/api/appointments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      console.log("Fetching appointment details for ID:", appointmentId);

      const appointment = await storage.getAppointmentById(appointmentId);

      if (!appointment) {
        console.log("No appointment found for ID:", appointmentId);
        return res.status(404).json({ error: "Appointment not found" });
      }

      console.log("Retrieved appointment:", appointment);
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  // Update appointment endpoint
  app.patch("/api/appointments/:id", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== "manager" && req.user.role !== "teacher")
    ) {
      return res.sendStatus(403);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      const { teacherId, status, teacherAssignment } = req.body;

      // Create update object with only defined values
      const updateData: any = {};

      // Validate status if provided
      if (status) {
        console.log("Requested status update:", status);
        console.log("Valid statuses:", Object.values(AppointmentStatus));
        console.log("Status type:", typeof status);

        // Special case for rejection to ensure we use the exact database enum value
        if (status === AppointmentStatus.REJECTED || status === "rejected") {
          // Use literal string exactly as in database enum
          updateData.status = "rejected";
          console.log(
            "Rejection status detected, using direct enum value:",
            updateData.status,
          );
        } else {
          // For other statuses, find the matching enum value
          const matchedStatus = Object.entries(AppointmentStatus).find(
            ([key, value]) => value === status || key === status.toUpperCase(),
          );

          if (matchedStatus) {
            // Use the exact value from the enum
            updateData.status = matchedStatus[1];
            console.log("Status validated and set to:", updateData.status);
          } else {
            console.error("Invalid appointment status:", status);
            return res.status(400).json({
              error: "Invalid appointment status",
              details: `Status '${status}' is not valid. Valid statuses are: ${Object.values(AppointmentStatus).join(", ")}`,
            });
          }
        }
      }

      if (teacherId !== undefined && teacherId !== null) {
        updateData.teacherId = teacherId;
      }

      if (teacherAssignment !== undefined) {
        updateData.teacherAssignment = teacherAssignment;
      }

      const appointment = await storage.updateAppointment(
        appointmentId,
        updateData,
      );

      // Immediately broadcast the update to all connected clients
      broadcastUpdate("appointmentUpdate", {
        action: "update",
        appointment,
        timestamp: new Date().toISOString(),
      });

      // Send Telegram notification after successful update
      let notificationSent = false;
      if (teacherId && status === AppointmentStatus.REQUESTED) {
        try {
          notificationSent = await notifyTeacherAboutAppointment(
            appointmentId,
            teacherId,
          );
        } catch (error) {
          console.error("Failed to send Telegram notification:", error);
        }
      }

      res.json({
        ...appointment,
        notificationSent,
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error details:", errorMessage);
      res.status(500).json({
        error: "Failed to update appointment",
        details: errorMessage,
      });
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
      const todayAppointments = appointments.filter((appointment) => {
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
      return res.sendStatus(450);
    }

    try {
      const responses = await storage.getAllQuestionnaireResponses();
      res.json(responses);
    } catch (error) {
      console.error("Error fetching questionnaire responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  // Add endpoint for updating student response status
  app.patch("/api/appointments/:id/response", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    try {
      const appointmentId = parseInt(req.params.id);
      const { responded } = req.body;

      // Update the status to RESPONDED when the toggle is checked
      const status = responded
        ? AppointmentStatus.RESPONDED
        : AppointmentStatus.ASSIGNED;

      const appointment = await storage.updateAppointment(appointmentId, {
        status,
      });

      // Broadcast the update
      broadcastUpdate("appointmentUpdate", { action: "update", appointment });

      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment response status:", error);
      res.status(500).json({ error: "Failed to update response status" });
    }
  });

  return httpServer;
}
