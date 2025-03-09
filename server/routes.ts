import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAppointmentSchema, insertAvailabilitySchema, insertQuestionnaireSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Teacher routes
  app.post("/api/availabilities", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    const availability = await storage.createAvailability({
      ...req.body,
      teacherId: req.user.id,
    });
    res.json(availability);
  });

  app.get("/api/teachers/:id/availabilities", async (req, res) => {
    const availabilities = await storage.getAvailabilitiesByTeacher(
      parseInt(req.params.id)
    );
    res.json(availabilities);
  });

  // Student routes
  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "student") {
      return res.sendStatus(403);
    }

    const appointment = await storage.createAppointment({
      ...req.body,
      studentId: req.user.id,
      status: "pending",
    });
    res.json(appointment);
  });

  app.get("/api/students/:id/appointments", async (req, res) => {
    const appointments = await storage.getAppointmentsByStudent(
      parseInt(req.params.id)
    );
    res.json(appointments);
  });

  // Questionnaire routes
  app.post("/api/questionnaire-responses", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "teacher") {
      return res.sendStatus(403);
    }

    const response = await storage.createQuestionnaireResponse(req.body);
    res.json(response);
  });

  app.get("/api/appointments/:id/questionnaire", async (req, res) => {
    const response = await storage.getQuestionnaireResponse(
      parseInt(req.params.id)
    );
    res.json(response);
  });

  const httpServer = createServer(app);
  return httpServer;
}
