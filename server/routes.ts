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
  AppointmentStatusArabic,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, inArray, desc } from "drizzle-orm";
import { users, availabilities, appointments, Section } from "@shared/schema";
import {
  sendTelegramNotification,
  notifyTeacherAboutAppointment,
  notifyTeacherAboutAssignmentChange,
  notifyManagerAboutAppointment,
  notifyTeacherAboutDeletedAppointment,
  notifyTeacherAboutReassignedAppointment,
  notifyTeacherAboutTimeChange,
  notifyManagerAboutRejectedAppointment,
  notifyManagerAboutAcceptedAppointment,
  notifyManagerAboutCompletedAppointment,
} from "./telegram";
import { startOfDay, endOfDay, format } from "date-fns"; // Added format import
import { addHours } from "date-fns";

// Keep track of all connected clients
const clients = new Map<string, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create WebSocket server before setting up auth
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    verifyClient: (info, cb) => {
      const cookies = info.req.headers.cookie;
      if (!cookies) {
        console.log("WebSocket connection rejected: No cookies found");
        cb(false, 401, "Unauthorized");
        return;
      }

      // Pass the connection and let the session middleware handle auth
      console.log("WebSocket connection attempt with cookies:", cookies);
      cb(true);
    },
  });
  
  // Set up WebSocket connection handling
  wss.on("connection", (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`WebSocket client connected with ID: ${clientId}`);

    clients.set(clientId, ws);

    // Send initial connection confirmation
    ws.send(
      JSON.stringify({
        type: "connection",
        status: "connected",
        clientId,
      }),
    );

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });

    ws.on("close", (code, reason) => {
      console.log(`WebSocket client ${clientId} disconnected`, {
        code,
        reason: reason.toString(),
      });
      clients.delete(clientId);
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
  
  // Setup auth before our custom routes
  setupAuth(app);
  
  // Note: The teacher/created-appointments page is now handled by the React frontend
  // instead of serving HTML directly from the backend. The data is served via the API
  // endpoint at /api/teachers/:id/created-appointments

  // Helper function to broadcast updates with error handling and retries
  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    console.log(`Broadcasting ${type} update to ${clients.size} clients`);

    // Use Array.from to convert the Map entries to an array for iteration
    Array.from(clients.entries()).forEach(([clientId, client]) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else if (client.readyState !== WebSocket.CONNECTING) {
          console.log(`Removing dead connection for client ${clientId}`);
          clients.delete(clientId);
        }
      } catch (error: unknown) {
        console.error(
          `Error broadcasting message to client ${clientId}:`,
          error instanceof Error ? error.message : String(error),
        );
        clients.delete(clientId);
      }
    });
  };

  // Endpoint to get all sections
  app.get("/api/sections", async (req, res) => {
    try {
      // Get all defined sections from the Section constant
      const predefinedSections = Object.values(Section);

      // Get all users with non-null sections
      const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "student"))
        .execute();

      // Extract unique sections from database
      const sectionsSet = new Set<string>(predefinedSections);
      allUsers.forEach((user) => {
        if (user.section) {
          sectionsSet.add(user.section);
        }
      });

      // Convert to array
      const sections = Array.from(sectionsSet);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching sections:", error);
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  });

  // Endpoint to get students by section
  app.get("/api/section/:section/students", async (req, res) => {
    try {
      const { section } = req.params;

      // Create a mapping for section names between schema and database
      const sectionMapping: Record<string, string[]> = {
        aasem: ["aasem"],
        khaled: ["khaled"], // Fixed: removed 'bader' from khaled's section mapping
        mmdoh: ["mmdoh"],
        obada: ["obada"],
        other: ["other"],
        awab: ["awab"],
        zuhair: ["zuhair"],
        yahia: ["yahia"],
        omar: ["omar"],
        "dubai-omar": ["dubai-omar"],
        motaa: ["motaa"],
        mahmoud: ["mahmoud"],
        kibar: ["kibar"],
        bader: ["bader"], // Added separate mapping for bader
      };

      // Get all users in the section
      const dbSections = sectionMapping[section] || [section];

      // Fetch all students that match any of the sections in dbSections
      let sectionUsers = [];

      if (dbSections.length === 1) {
        // If there's only one section, use simple equals
        sectionUsers = await db
          .select()
          .from(users)
          .where(eq(users.section, dbSections[0]))
          .execute();
      } else {
        // Otherwise, fetch all users and filter in memory
        const allUsers = await db
          .select()
          .from(users)
          .where(eq(users.role, "student"))
          .execute();

        sectionUsers = allUsers.filter(
          (user) => user.section && dbSections.includes(user.section),
        );
      }

      console.log(
        `Found ${sectionUsers.length} users for section ${section} (mapped to ${dbSections.join(", ")})`,
      );
      res.json(sectionUsers);
    } catch (error) {
      console.error("Error fetching students by section:", error);
      res.status(500).json({ error: "Failed to fetch students by section" });
    }
  });

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

  // Update user data
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const userId = parseInt(req.params.id);

      // Users can only update their own data
      if (req.user.id !== userId) {
        return res
          .status(403)
          .json({ error: "You can only update your own profile" });
      }

      const { telegramUsername } = req.body;

      // Update user with provided data
      const updatedUser = await storage.updateUser(userId, {
        telegramUsername,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
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
        return res.status(404).json({
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

      // Simply parse the incoming startTime as-is, without manager-specific offset
      const adjustedStartTime = new Date(startTime);

      console.log(`Appointment requested with data:`, {
        startTime: adjustedStartTime.toISOString(),
        studentId,
        teacherAssignment,
      });

      // Create the appointment data
      const appointmentData: any = {
        startTime: adjustedStartTime.toISOString(),
        // If `studentId` is provided in the request, use that; otherwise default to the user's ID (e.g. student booking themselves)
        studentId: studentId || req.user.id,
        status: "pending",
        teacherAssignment,
      };
      
      // If a teacher is creating the appointment, record their ID
      if (req.user.role === "teacher") {
        appointmentData.createdByTeacherId = req.user.id;
        console.log(`Setting createdByTeacherId to ${req.user.id} for teacher-created appointment`);
      }
      
      const parsedData = insertAppointmentSchema.parse(appointmentData);

      const appointment = await storage.createAppointment(parsedData);

      // Broadcast the new appointment
      broadcastUpdate("appointmentUpdate", { action: "create", appointment });

      // Send notification to managers
      let managerNotificationSent = false;
      try {
        managerNotificationSent = await notifyManagerAboutAppointment(
          appointment.id,
        );
        console.log(
          `Manager notification ${managerNotificationSent ? "sent" : "failed"} for appointment ${appointment.id}`,
        );
      } catch (notificationError) {
        console.error("Error sending manager notification:", notificationError);
      }

      res.json({
        ...appointment,
        managerNotificationSent,
      });
    } catch (error) {
      console.error("Error creating appointment:", error);

      // Check if it's a duplicate appointment error (collision in times, etc.)
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
    if (!req.isAuthenticated() || (req.user.role !== "teacher" && req.user.role !== "manager")) {
      return res.sendStatus(403);
    }

    try {
      const parsedData = insertQuestionnaireSchema.parse(req.body);
      
      // Check if this response has a custom "attended" field (parsed before JSON creation)
      const notAttended = req.body.isAbsent === true;
      
      // Set status based on attendance
      const status = notAttended ? AppointmentStatus.NOT_ATTENDED : AppointmentStatus.DONE;
      
      // Update appointment with appropriate status
      const appointment = await storage.updateAppointment(
        parsedData.appointmentId,
        {
          status: status,
        },
      );

      // Create questionnaire response
      const response = await storage.createQuestionnaireResponse(parsedData);

      // Broadcast appointment update
      broadcastUpdate("appointmentUpdate", { 
        action: "update", 
        appointment 
      });
      
      // Also broadcast a specific questionnaire response update
      broadcastUpdate("questionnaireResponse", {
        action: "create",
        appointmentId: parsedData.appointmentId,
        response,
        timestamp: new Date().toISOString()
      });

      // Send notification to manager if appointment was completed (not marked as not_attended)
      if (status === AppointmentStatus.DONE && appointment.teacherId) {
        try {
          console.log(`Sending completion notification for appointment ${parsedData.appointmentId} after questionnaire submission`);
          const notificationSent = await notifyManagerAboutCompletedAppointment(
            parsedData.appointmentId,
            appointment.teacherId
          );
          
          if (notificationSent) {
            console.log(`Successfully sent completion notification to managers`);
          } else {
            console.log(`Failed to send completion notification to managers`);
          }
        } catch (error) {
          console.error("Error sending completion notification:", error);
        }
      }

      res.json(response);
    } catch (error) {
      console.error("Error creating questionnaire response:", error);
      res.status(400).json({ error: "Invalid questionnaire data" });
    }
  });
  
  // Get questionnaire response for a specific appointment
  app.get("/api/appointments/:id/questionnaire", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    try {
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      const response = await storage.getQuestionnaireResponse(appointmentId);
      res.json(response || null);
    } catch (error) {
      console.error("Error fetching questionnaire response:", error);
      res.status(500).json({ error: "Failed to fetch questionnaire response" });
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
      const { teacherId, status, teacherAssignment, startTime } = req.body;

      // Get the current appointment before updating it
      const currentAppointment = await storage.getAppointmentById(appointmentId);
      if (!currentAppointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Store the previous teacherId to send notification if it's being changed
      const previousTeacherId = currentAppointment.teacherId;
      
      // Flags to track appointment status changes (will be updated in the status check below)
      let isRejection = false;
      let isAcceptance = false;
      let isCompletion = false;
      
      // Create update object with only defined values
      const updateData: any = {};
      
      // Handle startTime if provided
      let originalStartTime = null;
      if (startTime) {
        console.log("Updating appointment startTime to:", startTime);
        // Store the original time for notification
        if (currentAppointment && currentAppointment.startTime) {
          originalStartTime = currentAppointment.startTime;
        }
        updateData.startTime = startTime;
      }

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
          
          // Store the rejection flag to send notification later after the update is completed
          isRejection = true;
        } 
        // Special case for accepting appointment (ASSIGNED status)
        else if (status === AppointmentStatus.ASSIGNED || status === "assigned") {
          // Use literal string exactly as in database enum
          updateData.status = "assigned";
          console.log(
            "Appointment acceptance detected, using direct enum value:",
            updateData.status,
          );
          
          // Store the acceptance flag to send notification later after the update is completed
          isAcceptance = true;
        }
        // Special case for completed appointment (DONE status) - check both English and Arabic values
        else if (status === AppointmentStatus.DONE || status === "done" || status === "مكتمل" || status === AppointmentStatusArabic.done) {
          // Use literal string exactly as in database enum
          updateData.status = "done";
          console.log(
            "Appointment completion detected, using direct enum value:",
            updateData.status,
          );
          
          // Store the completion flag to send notification later after the update is completed
          isCompletion = true;
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
      
      // Handle appointment time change notification
      if (originalStartTime && appointment.teacherId) {
        try {
          console.log(`Notifying teacher ${appointment.teacherId} about time change from ${originalStartTime} to ${appointment.startTime}`);
          const timeChangeNotificationSent = await notifyTeacherAboutTimeChange(
            appointment.teacherId,
            appointmentId,
            originalStartTime,
            appointment.startTime
          );
          
          if (timeChangeNotificationSent) {
            notificationSent = true;
            console.log("Teacher time change notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send time change notification:", error);
        }
      }
      
      // Handle teacher reassignment notification
      if (teacherId && previousTeacherId && teacherId !== previousTeacherId) {
        // This is a reassignment - notify the previous teacher
        try {
          console.log(`Notifying previous teacher ${previousTeacherId} about appointment reassignment to teacher ${teacherId}`);
          const reassignmentNotificationSent = await notifyTeacherAboutReassignedAppointment(
            previousTeacherId,
            appointmentId,
            teacherId
          );
          
          if (reassignmentNotificationSent) {
            notificationSent = true;
            console.log("Teacher reassignment notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send reassignment notification:", error);
        }
      }
      
      // Check if we need to send teacher assignment update notification
      if (teacherAssignment !== undefined && appointment.teacherId) {
        try {
          console.log(`Notifying teacher ${appointment.teacherId} about assignment change to "${teacherAssignment}"`);
          const assignmentNotificationSent = await notifyTeacherAboutAssignmentChange(
            appointmentId,
            appointment.teacherId,
            teacherAssignment
          );
          
          if (assignmentNotificationSent) {
            notificationSent = true;
            console.log("Teacher assignment change notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send assignment change notification:", error);
        }
      }
      
      // Check if we need to send new teacher assignment notification
      if (teacherId && status === AppointmentStatus.REQUESTED) {
        try {
          const teacherNotificationSent = await notifyTeacherAboutAppointment(
            appointmentId,
            teacherId,
          );
          
          if (teacherNotificationSent) {
            notificationSent = true;
          }
        } catch (error) {
          console.error("Failed to send new teacher notification:", error);
        }
      }
      
      // Check if this is a rejection and notify managers
      if (isRejection && currentAppointment.teacherId) {
        try {
          console.log(`Notifying managers about appointment ${appointmentId} rejected by teacher ${currentAppointment.teacherId}`);
          const rejectionNotificationSent = await notifyManagerAboutRejectedAppointment(
            appointmentId,
            currentAppointment.teacherId
          );
          
          if (rejectionNotificationSent) {
            notificationSent = true;
            console.log("Manager rejection notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send rejection notification to managers:", error);
        }
      }
      
      // Check if this is an acceptance and notify managers
      if (isAcceptance && currentAppointment.teacherId) {
        try {
          console.log(`Notifying managers about appointment ${appointmentId} accepted by teacher ${currentAppointment.teacherId}`);
          const acceptanceNotificationSent = await notifyManagerAboutAcceptedAppointment(
            appointmentId,
            currentAppointment.teacherId
          );
          
          if (acceptanceNotificationSent) {
            notificationSent = true;
            console.log("Manager acceptance notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send acceptance notification to managers:", error);
        }
      }
      
      // Check if this is a completion and notify managers
      if (isCompletion && currentAppointment.teacherId) {
        try {
          console.log(`Notifying managers about appointment ${appointmentId} completed by teacher ${currentAppointment.teacherId}`);
          const completionNotificationSent = await notifyManagerAboutCompletedAppointment(
            appointmentId,
            currentAppointment.teacherId
          );
          
          if (completionNotificationSent) {
            notificationSent = true;
            console.log("Manager completion notification sent successfully");
          }
        } catch (error) {
          console.error("Failed to send completion notification to managers:", error);
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
  
  // Delete appointment endpoint
  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "manager") {
        return res.sendStatus(403);
      }

      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      // Get the appointment details from storage before deletion
      const appointment = await storage.getAppointmentById(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // If there's a teacher assigned, notify them about the deletion
      let notificationSent = false;
      if (appointment.teacherId) {
        try {
          // Get student name
          const student = await db
            .select()
            .from(users)
            .where(eq(users.id, appointment.studentId))
            .limit(1);
            
          const studentName = student.length
            ? student[0].username
            : `طالب ${appointment.studentId}`;
            
          // Format time
          const appointmentTime = format(
            new Date(appointment.startTime),
            "h:mm a"
          );
          
          notificationSent = await notifyTeacherAboutDeletedAppointment(
            appointment.teacherId,
            studentName,
            appointmentTime
          );
          
          console.log(`Teacher notification status: ${notificationSent ? 'Sent' : 'Failed'}`);
        } catch (error) {
          console.error("Failed to send teacher notification:", error);
        }
      }

      // Delete the appointment
      await storage.deleteAppointment(appointmentId);
      
      // Notify all connected clients about the deletion
      const message = JSON.stringify({
        type: "appointmentUpdate",
        data: {
          action: "delete",
          appointmentId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
      
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      
      return res.json({ 
        success: true, 
        deleted: true, 
        notificationSent 
      });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      return res
        .status(500)
        .json({ error: "Failed to delete appointment" });
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

  // Get appointments created by a teacher
  app.get("/api/teachers/:id/created-appointments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    // Only allow teachers to access their own created appointments or managers to view any teacher's appointments
    if (req.user.role !== "manager" && (req.user.role !== "teacher" || req.user.id !== parseInt(req.params.id))) {
      return res.sendStatus(403);
    }

    try {
      const teacherId = parseInt(req.params.id);
      const appointments = await storage.getAppointmentsCreatedByTeacher(teacherId);
      
      console.log(`Fetched ${appointments.length} appointments created by teacher ${teacherId}`);
      
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments created by teacher:", error);
      res.status(500).json({ error: "Failed to fetch created appointments" });
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

  // Add new routes for independent assignments
  app.post("/api/independent-assignments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      console.log("Creating independent assignment with data:", req.body);
      const assignment = await storage.createIndependentAssignment(req.body);
      res.json(assignment);
    } catch (error) {
      console.error("Error creating independent assignment:", error);
      res
        .status(400)
        .json({ error: "Failed to create independent assignment" });
    }
  });
  
  // Independent questionnaire endpoint for teachers
  app.post("/api/independent-questionnaire", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    try {
      const { studentId, date, question1, question2, question3, question4 } = req.body;
      
      if (!studentId || !date || !question3 || !question4) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log("Creating independent questionnaire with data:", {
        studentId,
        teacherId: req.user.id,
        date,
        createdByTeacherId: req.user.id,
        question1,
        question2,
        question3,
        question4
      });

      try {
        // First, create a new appointment record
        const appointment = await storage.createAppointment({
          studentId: parseInt(studentId),
          teacherId: req.user.id,
          startTime: date,
          status: AppointmentStatus.DONE,
          teacherAssignment: "",
          createdByTeacherId: req.user.id
        });

        console.log("Created appointment:", appointment);

        if (!appointment || !appointment.id) {
          throw new Error("Failed to create appointment record");
        }

        // Now create the questionnaire response linked to the appointment
        // Make sure all required fields are provided
        const responseData = {
          appointmentId: appointment.id,
          question1: question1 || "نعم",  // Default if not provided
          question2: question2 || "نعم",  // Default if not provided
          question3: question3,           // Required from validation above
          question4: question4            // Required from validation above
        };

        console.log("Creating questionnaire response with data:", responseData);
        
        const response = await storage.createQuestionnaireResponse(responseData);
        console.log("Created questionnaire response:", response);

        if (!response) {
          throw new Error("Failed to create questionnaire response");
        }

        // Return the response with the appointment ID
        res.setHeader('Content-Type', 'application/json');
        return res.json({ 
          success: true, 
          response,
          appointment
        });
      } catch (dbError: any) {
        console.error("Database error:", dbError);
        return res.status(500).json({ 
          error: "Database error", 
          details: dbError.message || "Unknown database error"
        });
      }
    } catch (error: any) {
      console.error("Error creating independent questionnaire:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(400).json({ 
        error: "Failed to submit independent questionnaire", 
        details: error.message || "Unknown error" 
      });
    }
  });

  app.get("/api/independent-assignments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      const assignments = await storage.getIndependentAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching independent assignments:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch independent assignments" });
    }
  });

  // Modify the statistics endpoint to include group information
  app.get("/api/statistics", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "manager") {
      return res.sendStatus(403);
    }

    try {
      // Get all questionnaire responses and appointments
      const responses = await storage.getAllQuestionnaireResponses();
      const assignments = await storage.getIndependentAssignments();
      const students = await db
        .select()
        .from(users)
        .where(eq(users.role, "student"));
      
      // Get all appointments to track not_attended status
      const allAppointments = await storage.getAllAppointments();

      // Create a map to store statistics by student
      const studentStats = new Map();

      // Process questionnaire responses
      responses.forEach((response) => {
        const student = students.find((s) => s.id === response.studentId);
        const stats = studentStats.get(response.studentId) || {
          studentId: response.studentId,
          studentName: response.studentName,
          section: student?.section || "غير محدد", // Add section information
          question1YesCount: 0,
          question2YesCount: 0,
          notAttendedCount: 0,  // Track students who didn't attend
          question3Responses: [],
          assignmentResponses: [],
          createdAt: response.createdAt,
        };

        if (response.question1?.toLowerCase().includes("نعم")) {
          stats.question1YesCount++;
        }
        if (response.question2?.toLowerCase().includes("نعم")) {
          stats.question2YesCount++;
        }
        if (response.question3) {
          stats.question3Responses.push(
            `${format(new Date(response.createdAt), "MM/dd")} - ${response.question3}`,
          );
        }

        studentStats.set(response.studentId, stats);
      });

      // Process independent assignments
      assignments.forEach((assignment) => {
        const student = students.find((s) => s.id === assignment.studentId);
        const stats = studentStats.get(assignment.studentId) || {
          studentId: assignment.studentId,
          studentName: assignment.studentName,
          section: student?.section || "غير محدد", // Add section information
          question1YesCount: 0,
          question2YesCount: 0,
          notAttendedCount: 0,  // Track students who didn't attend
          question3Responses: [],
          assignmentResponses: [],
          createdAt: assignment.submittedAt,
        };

        if (assignment.assignment) {
          const assignmentText = `${format(new Date(assignment.submittedAt), "MM/dd")} - مهمة: ${assignment.assignment}`;
          stats.assignmentResponses.push(assignmentText);

          // If this is a more recent activity, update the createdAt timestamp
          const assignmentDate = new Date(assignment.submittedAt);
          const currentDate = stats.createdAt
            ? new Date(stats.createdAt)
            : new Date(0);

          if (assignmentDate > currentDate) {
            stats.createdAt = assignment.submittedAt;
          }
        }

        studentStats.set(assignment.studentId, stats);
      });

      // Process not_attended appointments
      allAppointments.forEach((appointment) => {
        if (appointment.status === AppointmentStatus.NOT_ATTENDED && appointment.studentId) {
          const student = students.find((s) => s.id === appointment.studentId);
          if (student) {
            const stats = studentStats.get(appointment.studentId) || {
              studentId: appointment.studentId,
              studentName: student.username,
              section: student.section || "غير محدد",
              question1YesCount: 0,
              question2YesCount: 0,
              notAttendedCount: 0,
              question3Responses: [],
              assignmentResponses: [],
              createdAt: appointment.startTime,
            };
            
            // Increment the not attended count
            stats.notAttendedCount++;
            
            studentStats.set(appointment.studentId, stats);
          }
        }
      });

      // Convert map to array and format the response
      const statistics = Array.from(studentStats.entries()).map(
        ([studentId, stats]) => {
          // Include independent assignments in allResponses
          const allResponses = [
            ...stats.question3Responses,
            ...stats.assignmentResponses,
          ]
            .sort(
              (a, b) =>
                new Date(a.split(" - ")[0]).getTime() -
                new Date(b.split(" - ")[0]).getTime(),
            )
            .join(" | ");

          return {
            studentId,
            ...stats,
            allResponses,
          };
        },
      );

      console.log("Sending statistics:", statistics);
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  return httpServer;
}
