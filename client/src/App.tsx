import * as React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import BookAppointment from "@/pages/student/book-appointment";
import TeacherAvailability from "@/pages/teacher/availability";
import TeacherQuestionnaireSubmission from "@/pages/teacher/questionnaire-submission";
import AcceptAppointment from "@/pages/teacher/accept-appointment";
import TeacherAppointments from "@/pages/teacher/appointments";
import TeacherCreatedAppointments from "@/pages/teacher/created-appointments";
import ManagerAppointments from "@/pages/manager/appointments";
import ManagerResults from "@/pages/manager/results";
import AssignTeacher from "@/pages/manager/assign-teacher";
import ManagerQuestionnaire from "@/pages/manager/questionnaire";
import ManagerTeachersAvailability from "@/pages/manager/teachers-availability";
import StudentAppointments from "@/pages/student/appointments";
import { ProtectedRoute } from "./lib/protected-route";
import { Navbar } from "@/components/Navbar";

function Router() {
  return (
    <>
      <Navbar />
      <Switch>
        <Route path="/auth" component={AuthPage} />

        {/* Student routes */}
        <ProtectedRoute
          path="/student/book-appointment"
          role="student"
          component={BookAppointment}
        />
        <ProtectedRoute
          path="/student/appointments"
          role="student"
          component={StudentAppointments}
        />

        {/* Teacher routes */}
        <ProtectedRoute
          path="/teacher/availability"
          role="teacher"
          component={TeacherAvailability}
        />
        <ProtectedRoute
          path="/teacher/appointments"
          role="teacher"
          component={TeacherAppointments}
        />
        <ProtectedRoute
          path="/teacher/questionnaire-submission/:appointmentId"
          role="teacher"
          component={TeacherQuestionnaireSubmission}
        />
        <ProtectedRoute
          path="/teacher/accept-appointment/:id"
          role="teacher"
          component={AcceptAppointment}
        />
        <ProtectedRoute
          path="/teacher/created-appointments"
          role="teacher"
          component={TeacherCreatedAppointments}
        />

        {/* Manager routes */}
        <ProtectedRoute
          path="/manager/appointments"
          role="manager"
          component={ManagerAppointments}
        />
        <ProtectedRoute
          path="/manager/results"
          role="manager"
          component={ManagerResults}
        />
        <ProtectedRoute
          path="/manager/assign-teacher/:appointmentId"
          role="manager"
          component={AssignTeacher}
        />
        <ProtectedRoute
          path="/manager/questionnaire"
          role="manager"
          component={ManagerQuestionnaire}
        />
        <ProtectedRoute
          path="/manager/teachers-availability"
          role="manager"
          component={ManagerTeachersAvailability}
        />
        
        {/* Root path handling based on user role */}
        <Route path="/">
          {() => {
            const { user } = useAuth();
            console.log("Root path handler, user:", user?.username, "role:", user?.role);
            
            if (user) {
              if (user.role === UserRole.TEACHER) {
                // Critical redirection for teachers to appointments page
                console.log("Teacher detected, redirecting to /teacher/appointments");
                window.location.href = "/teacher/appointments";
                return <div style={{ display: 'none' }}>Redirecting...</div>;
              } else if (user.role === UserRole.STUDENT) {
                return <Redirect to="/student/appointments" />;
              } else if (user.role === UserRole.MANAGER) {
                return <Redirect to="/manager/appointments" />;
              }
            }
            
            console.log("No user or unrecognized role, redirecting to /auth");
            return <Redirect to="/auth" />;
          }}
        </Route>
        
        {/* Explicit redirect from /teacher to appointments */}
        <Route path="/teacher">
          {() => {
            console.log("Teacher path handler - redirecting to /teacher/appointments");
            window.location.href = "/teacher/appointments";
            return <div style={{ display: 'none' }}>Redirecting...</div>;
          }}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
