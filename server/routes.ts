import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAppointmentSchema, insertAvailabilitySchema, insertQuestionnaireSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

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

      // Parse the ISO strings into Date objects
      const parsedData = insertAvailabilitySchema.parse({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
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
      const availabilities = await storage.getAvailabilitiesByTeacher(teacherId);
      console.log("Found availabilities:", availabilities);
      res.json(availabilities);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      res.status(500).json({ error: "Failed to fetch availabilities" });
    }
  });

  // Student routes
  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "student") {
      return res.sendStatus(403);
    }

    try {
      const parsedData = insertAppointmentSchema.parse({
        ...req.body,
        studentId: req.user.id,
        status: "pending",
      });

      const appointment = await storage.createAppointment(parsedData);
      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
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
      res.json(appointments);
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

  const httpServer = createServer(app);
  return httpServer;
}