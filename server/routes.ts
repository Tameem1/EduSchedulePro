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
import { users, availabilities, Section } from "@shared/schema";
import {
  sendTelegramNotification,
  notifyTeacherAboutAppointment,
  notifyManagerAboutAppointment,
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
  
  // Full-featured route for teacher-created appointments (AFTER auth setup)
  app.get('/teacher/created-appointments', async (req: any, res) => {
    console.log("Teacher created appointments page accessed!");
    
    if (!req.isAuthenticated()) {
      return res.redirect('/auth');
    }
    
    if (req.user.role !== 'teacher') {
      return res.redirect('/auth');
    }
    
    const teacherId = req.user.id;
    
    try {
      // Get appointments created by this teacher
      const createdAppointments = await storage.getAppointmentsCreatedByTeacher(teacherId);
      console.log(`Found ${createdAppointments.length} appointments created by teacher ${teacherId}`);
      
      // Get all students for display purposes
      const allStudents = await db.select().from(users).where(eq(users.role, 'student')).execute();
      
      // Get all teachers for display purposes
      const allTeachers = await db.select().from(users).where(eq(users.role, 'teacher')).execute();
      
      // Create a map of student IDs to names for easier lookup
      const studentNames: Record<number, string> = {};
      allStudents.forEach(student => {
        studentNames[student.id] = student.username;
      });
      
      // Create a map of teacher IDs to names for easier lookup
      const teacherNames: Record<number, string> = {};
      allTeachers.forEach(teacher => {
        teacherNames[teacher.id] = teacher.username;
      });
      
      // Helper function to get status in Arabic using shared constants
      const getStatusInArabic = (status: string) => {
        return AppointmentStatusArabic[status as keyof typeof AppointmentStatusArabic] || status;
      };
      
      // Helper function to format date nicely
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        return `${day}/${month}/${year} ${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
      };
      
      // Generate HTML for each appointment
      let appointmentsHtml = '';
      
      if (createdAppointments.length > 0) {
        createdAppointments.forEach(appointment => {
          const studentName = studentNames[appointment.studentId] || 'طالب غير معروف';
          const assignedTeacherName = appointment.teacherId ? teacherNames[appointment.teacherId] || 'معلم غير معروف' : null;
          
          appointmentsHtml += `
            <div class="appointment-card" data-status="${appointment.status}">
              <div class="appointment-header">
                <span class="appointment-date">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; position: relative; top: 2px;">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                  </svg>
                  ${formatDate(appointment.startTime)}
                </span>
                <span class="appointment-status status-${appointment.status}">${getStatusInArabic(appointment.status)}</span>
              </div>
              <div class="appointment-details">
                <p>
                  <span class="detail-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 6px; position: relative; top: 2px;">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    الطالب:
                  </span>
                  ${studentName}
                </p>
                <p>
                  <span class="detail-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 6px; position: relative; top: 2px;">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    المعلم المعين:
                  </span>
                  ${assignedTeacherName || 'لم يتم التعيين بعد'}
                </p>
                <p>
                  <span class="detail-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 6px; position: relative; top: 2px;">
                      <path d="m16 6 4 14"></path>
                      <path d="M12 6v14"></path>
                      <path d="M8 8v12"></path>
                      <path d="M4 4v16"></path>
                    </svg>
                    التعيين:
                  </span>
                  ${appointment.teacherAssignment || 'لا يوجد'}
                </p>
              </div>
            </div>
          `;
        });
      } else {
        appointmentsHtml = `
          <div class="no-appointments">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
              <line x1="16" x2="16" y1="2" y2="6"></line>
              <line x1="8" x2="8" y1="2" y2="6"></line>
              <line x1="3" x2="21" y1="10" y2="10"></line>
              <path d="M8 14h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 18h.01"></path>
              <path d="M12 18h.01"></path>
              <path d="M16 18h.01"></path>
            </svg>
            <p>لم تقم بإنشاء أي مواعيد بعد</p>
            <button class="button button-outline" onclick="window.location.href='/teacher/appointments'">الذهاب لإنشاء موعد جديد</button>
          </div>
        `;
      }
      
      res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>المواعيد التي أنشأتها</title>
          <link rel="icon" type="image/png" href="/generated-icon.png">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
            
            :root {
              --primary: #2563eb;
              --primary-hover: #1d4ed8;
              --primary-light: #e6f0ff;
              --background: #f5f7fb;
              --card-bg: #ffffff;
              --text: #1e293b;
              --text-muted: #64748b;
              --border: #e2e8f0;
              --radius: 0.5rem;
              --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              
              --status-pending: #6B7280;
              --status-requested: #3B82F6;
              --status-assigned: #10B981;
              --status-responded: #F59E0B;
              --status-done: #059669;
              --status-rejected: #EF4444;
            }
            
            * {
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Tajawal', Arial, sans-serif;
              background-color: var(--background);
              color: var(--text);
              margin: 0;
              padding: 0;
              direction: rtl;
              min-height: 100vh;
            }
            
            /* Navigation bar */
            .navbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              background-color: var(--card-bg);
              padding: 1rem 1.5rem;
              box-shadow: var(--shadow);
              position: sticky;
              top: 0;
              z-index: 10;
            }
            
            .navbar-brand {
              font-size: 1.5rem;
              font-weight: 700;
              color: var(--primary);
              text-decoration: none;
            }
            
            .navbar-nav {
              display: flex;
              gap: 1rem;
            }
            
            .nav-link {
              color: var(--text);
              text-decoration: none;
              padding: 0.5rem 0.75rem;
              border-radius: var(--radius);
              transition: background-color 0.2s;
            }
            
            .nav-link:hover {
              background-color: var(--primary-light);
            }
            
            .nav-link.active {
              color: var(--primary);
              font-weight: 500;
            }
            
            @media (max-width: 640px) {
              .navbar {
                flex-direction: column;
                align-items: flex-start;
                padding: 1rem;
              }
              
              .navbar-brand {
                margin-bottom: 0.5rem;
              }
              
              .navbar-nav {
                margin-top: 0.5rem;
                flex-wrap: wrap;
                width: 100%;
              }
              
              .nav-link {
                flex-grow: 1;
                text-align: center;
              }
            }
            
            /* Main container */
            .container {
              max-width: 1000px;
              margin: 2rem auto;
              padding: 0 1rem;
            }
            
            @media (max-width: 640px) {
              .container {
                margin: 1rem auto;
              }
            }
            
            /* Page header */
            .page-header {
              display: flex;
              flex-direction: column;
              margin-bottom: 2rem;
            }
            
            @media (min-width: 768px) {
              .page-header {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              }
            }
            
            .page-title {
              font-size: 1.75rem;
              font-weight: 700;
              margin: 0 0 1rem 0;
              color: var(--text);
            }
            
            @media (min-width: 768px) {
              .page-title {
                margin: 0;
              }
            }
            
            .button-group {
              display: flex;
              gap: 0.75rem;
              flex-wrap: wrap;
            }
            
            @media (max-width: 640px) {
              .button-group {
                width: 100%;
              }
              
              .button-group .button {
                flex: 1;
              }
            }
            
            /* Cards and appointments */
            .card {
              background-color: var(--card-bg);
              border-radius: var(--radius);
              box-shadow: var(--shadow);
              margin-bottom: 1.5rem;
              overflow: hidden;
            }
            
            .appointment-card {
              background-color: var(--card-bg);
              border: 1px solid var(--border);
              border-radius: var(--radius);
              padding: 1.25rem;
              margin-bottom: 1rem;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .appointment-card:hover {
              transform: translateY(-2px);
              box-shadow: var(--shadow-md);
            }
            
            .appointment-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 1rem;
              align-items: center;
              flex-wrap: wrap;
              gap: 0.5rem;
            }
            
            @media (max-width: 480px) {
              .appointment-header {
                flex-direction: column;
                align-items: flex-start;
              }
            }
            
            .appointment-date {
              font-weight: 700;
              font-size: 1rem;
              color: var(--text);
            }
            
            .appointment-status {
              padding: 0.35rem 0.75rem;
              border-radius: 9999px;
              font-size: 0.875rem;
              font-weight: 500;
              color: white;
              white-space: nowrap;
            }
            
            .status-pending {
              background-color: var(--status-pending);
            }
            
            .status-requested {
              background-color: var(--status-requested);
            }
            
            .status-assigned {
              background-color: var(--status-assigned);
            }
            
            .status-responded {
              background-color: var(--status-responded);
            }
            
            .status-done {
              background-color: var(--status-done);
            }
            
            .status-rejected {
              background-color: var(--status-rejected);
            }
            
            .appointment-details {
              margin-top: 0.75rem;
              display: grid;
              gap: 0.5rem;
            }
            
            .appointment-details p {
              margin: 0;
              line-height: 1.5;
            }
            
            .detail-label {
              font-weight: 700;
              color: var(--text);
              margin-left: 0.25rem;
            }
            
            .no-appointments {
              text-align: center;
              color: var(--text-muted);
              font-size: 1rem;
              padding: 3rem 1.5rem;
            }
            
            /* Buttons */
            .button {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0.5rem 1rem;
              border-radius: var(--radius);
              font-weight: 500;
              font-size: 0.875rem;
              cursor: pointer;
              transition: background-color 0.2s, transform 0.1s;
              text-decoration: none;
              border: none;
              white-space: nowrap;
            }
            
            .button:active {
              transform: scale(0.98);
            }
            
            .button-primary {
              background-color: var(--primary);
              color: white;
            }
            
            .button-primary:hover {
              background-color: var(--primary-hover);
            }
            
            .button-outline {
              background-color: transparent;
              color: var(--primary);
              border: 1px solid var(--border);
            }
            
            .button-outline:hover {
              background-color: var(--primary-light);
            }
            
            .button-back {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.875rem;
              color: var(--text-muted);
              text-decoration: none;
              margin-bottom: 1.5rem;
              transition: color 0.2s;
            }
            
            .button-back:hover {
              color: var(--primary);
            }
            
            /* Filter styles */
            .filter-container {
              margin-bottom: 1.5rem;
              background-color: var(--primary-light);
              padding: 1rem;
              border-radius: var(--radius);
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            }
            
            .filter-label {
              font-weight: 500;
              color: var(--text);
              font-size: 0.9rem;
            }
            
            .filter-buttons {
              display: flex;
              flex-wrap: wrap;
              gap: 0.5rem;
            }
            
            .filter-button {
              background: transparent;
              border: 1px solid var(--border);
              padding: 0.4rem 0.8rem;
              border-radius: var(--radius);
              font-size: 0.8rem;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .filter-button:hover {
              background-color: var(--primary-light);
              border-color: var(--primary);
            }
            
            .filter-button.active {
              background-color: var(--primary);
              color: white;
              border-color: var(--primary);
            }
            
            .counter-badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background-color: var(--primary-light);
              color: var(--primary);
              font-size: 0.8rem;
              font-weight: 500;
              border-radius: 9999px;
              padding: 0.25rem 0.6rem;
              margin-right: 0.5rem;
              vertical-align: middle;
            }
            
            /* Responsive adjustments for small screens */
            @media (max-width: 480px) {
              .page-title {
                font-size: 1.5rem;
              }
              
              .appointment-card {
                padding: 1rem;
              }
              
              .filter-buttons {
                gap: 0.3rem;
              }
              
              .filter-button {
                padding: 0.35rem 0.7rem;
                font-size: 0.75rem;
              }
            }
          </style>
        </head>
        <body>
          <!-- Main app navbar - matching React app styling -->
          <div class="bg-background border-b py-2 px-4 mb-4">
            <div class="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
              <div class="font-semibold text-center sm:text-right w-full sm:w-auto mb-2 sm:mb-0">
                لوحة تحكم المعلم
              </div>
              <button 
                class="button button-outline w-full sm:w-auto"
                onclick="window.location.href='/auth/logout'"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
          
          <div class="container">
            <!-- Back navigation with icon -->
            <a href="/teacher/appointments" class="inline-flex items-center text-primary hover:text-primary-hover mb-6 group transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1 transform rotate-180 transition-transform group-hover:-translate-x-1">
                <path d="m9 18 6-6-6-6"></path>
              </svg>
              <span>العودة إلى المواعيد</span>
            </a>
          
            <!-- Top actions: matches React app styling -->
            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <h1 class="text-xl md:text-2xl font-bold text-center sm:text-right">المواعيد التي أنشأتها <span id="appointment-counter" class="counter-badge">0/0</span></h1>
              <div class="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <a href="/teacher/availability" class="button button-outline w-full sm:w-auto">إدارة التوفر</a>
                <a href="/teacher/appointments" class="button button-outline w-full sm:w-auto">مواعيد المعلم</a>
                <button class="button button-primary w-full sm:w-auto" onclick="window.location.reload()">تحديث</button>
              </div>
            </div>
            
            <!-- Filter container with modern styling -->
            <div class="bg-card rounded-md p-4 mb-6 shadow-sm">
              <h2 class="text-base font-medium mb-3">تصفية حسب الحالة:</h2>
              <div class="flex flex-wrap gap-2 items-center">
                <button class="px-3 py-1 rounded-full border border-primary bg-primary text-white text-sm filter-button active" data-filter="all">الكل</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="pending">قيد الانتظار</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="requested">تم الطلب</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="assigned">تم التعيين</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="responded">تمت الاستجابة</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="done">مكتمل</button>
                <button class="px-3 py-1 rounded-full border border-primary text-primary hover:bg-primary-light text-sm filter-button" data-filter="rejected">مرفوض</button>
              </div>
            </div>
            
            <!-- Appointments grid -->
            <div class="grid grid-cols-1 gap-4">
              ${appointmentsHtml}
            </div>
          </div>

          <script>
            console.log("Created appointments page loaded successfully!");
            
            document.addEventListener('DOMContentLoaded', function() {
              // Add filter functionality to appointments
              var appointmentCards = document.querySelectorAll('.appointment-card');
              var filterButtons = document.querySelectorAll('[data-filter]');
              
              if (filterButtons.length > 0) {
                filterButtons.forEach(function(button) {
                  button.addEventListener('click', function() {
                    var filterValue = this.getAttribute('data-filter');
                    
                    // Remove active class from all buttons
                    filterButtons.forEach(function(btn) {
                      btn.classList.remove('active');
                    });
                    
                    // Add active class to clicked button
                    this.classList.add('active');
                    
                    // Show all appointments if 'all' is selected
                    if (filterValue === 'all') {
                      appointmentCards.forEach(function(card) {
                        card.style.display = 'block';
                      });
                      updateCounter();
                      return;
                    }
                    
                    // Filter appointments by status
                    appointmentCards.forEach(function(card) {
                      var status = card.getAttribute('data-status');
                      if (status === filterValue) {
                        card.style.display = 'block';
                      } else {
                        card.style.display = 'none';
                      }
                    });
                    
                    // Update counter
                    updateCounter();
                  });
                });
              }
              
              // Helper function to update appointment counter
              function updateCounter() {
                var visibleCards = document.querySelectorAll('.appointment-card[style="display: block;"]').length;
                var totalCards = appointmentCards.length;
                
                var counterElement = document.getElementById('appointment-counter');
                if (counterElement) {
                  counterElement.textContent = visibleCards + ' / ' + totalCards;
                }
              }
              
              // Initialize counter
              updateCounter();
            });
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error rendering created appointments page:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>خطأ</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
            
            :root {
              --primary: #2563eb;
              --primary-hover: #1d4ed8;
              --primary-light: #e6f0ff;
              --background: #f5f7fb;
              --card-bg: #ffffff;
              --text: #1e293b;
              --text-muted: #64748b;
              --error: #EF4444;
              --border: #e2e8f0;
              --radius: 0.5rem;
              --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            }
            
            * {
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Tajawal', Arial, sans-serif;
              background-color: var(--background);
              color: var(--text);
              margin: 0;
              padding: 0;
              direction: rtl;
              min-height: 100vh;
            }
            
            /* Navigation bar */
            .navbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              background-color: var(--card-bg);
              padding: 1rem 1.5rem;
              box-shadow: var(--shadow);
              position: sticky;
              top: 0;
              z-index: 10;
            }
            
            .navbar-brand {
              font-size: 1.5rem;
              font-weight: 700;
              color: var(--primary);
              text-decoration: none;
            }
            
            .navbar-nav {
              display: flex;
              gap: 1rem;
            }
            
            @media (max-width: 640px) {
              .navbar {
                flex-direction: column;
                align-items: flex-start;
                padding: 1rem;
              }
              
              .navbar-brand {
                margin-bottom: 0.5rem;
              }
              
              .navbar-nav {
                margin-top: 0.5rem;
                flex-wrap: wrap;
              }
            }
            
            .container {
              max-width: 800px;
              margin: 3rem auto;
              padding: 2rem;
              background-color: var(--card-bg);
              border-radius: var(--radius);
              box-shadow: var(--shadow);
              text-align: center;
            }
            
            @media (max-width: 640px) {
              .container {
                margin: 1.5rem auto;
                padding: 1.5rem;
              }
            }
            
            .error-icon {
              color: var(--error);
              font-size: 3rem;
              margin-bottom: 1.5rem;
            }
            
            h1 {
              color: var(--error);
              font-size: 1.75rem;
              margin-top: 0;
              margin-bottom: 1rem;
            }
            
            p {
              color: var(--text-muted);
              margin-bottom: 2rem;
              line-height: 1.6;
            }
            
            .button {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0.75rem 1.5rem;
              background-color: var(--primary);
              color: white;
              border: none;
              border-radius: var(--radius);
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
              text-decoration: none;
              transition: background-color 0.2s;
            }
            
            .button:hover {
              background-color: var(--primary-hover);
            }
          </style>
        </head>
        <body>
          <!-- Main app navbar - matching React app styling -->
          <div class="bg-background border-b py-2 px-4 mb-4">
            <div class="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
              <div class="font-semibold text-center sm:text-right w-full sm:w-auto mb-2 sm:mb-0">
                لوحة تحكم المعلم
              </div>
              <button 
                class="button button-outline w-full sm:w-auto"
                onclick="window.location.href='/auth/logout'"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
          
          <div class="container">
            <div class="error-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h1>حدث خطأ</h1>
            <p>حدث خطأ أثناء محاولة تحميل المواعيد التي أنشأتها. الرجاء المحاولة مرة أخرى لاحقًا.</p>
            <button class="button" onclick="window.location.href='/teacher/appointments'">العودة إلى المواعيد</button>
          </div>
        </body>
        </html>
      `);
    }
  });

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
      // Get all questionnaire responses
      const responses = await storage.getAllQuestionnaireResponses();
      const assignments = await storage.getIndependentAssignments();
      const students = await db
        .select()
        .from(users)
        .where(eq(users.role, "student"));

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
