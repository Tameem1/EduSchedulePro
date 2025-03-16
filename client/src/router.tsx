import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Route, Switch, Redirect } from "wouter";
import AuthPage from "./pages/auth-page";
import BookAppointment from "./pages/student/book-appointment";
import StudentAppointments from "./pages/student/appointments";
import TeacherAvailability from "./pages/teacher/availability";
import TeacherAppointments from "./pages/teacher/appointments";
import TeacherQuestionnaireSubmission from "./pages/teacher/questionnaire-submission";
import ManagerAppointments from "./pages/manager/appointments";
import AssignTeacher from "./pages/manager/assign-teacher";
import ManagerQuestionnaire from "./pages/manager/questionnaire";
import Dashboard from "./pages/dashboard";

function ProtectedRoute({
  element: Element,
  allowedRoles,
}: {
  element: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Redirect to="/auth" />;
  }

  return Element;
}

export default function Router() {
  return (
    <Switch>
      <Route path="/" element={<Dashboard />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Student routes */}
      <Route 
        path="/student/book-appointment" 
        element={
          <ProtectedRoute 
            element={<BookAppointment />} 
            allowedRoles={[UserRole.STUDENT]} 
          />
        } 
      />
      <Route 
        path="/student/appointments" 
        element={
          <ProtectedRoute 
            element={<StudentAppointments />} 
            allowedRoles={[UserRole.STUDENT]} 
          />
        } 
      />

      {/* Teacher routes */}
      <Route 
        path="/teacher/availability" 
        element={
          <ProtectedRoute 
            element={<TeacherAvailability />} 
            allowedRoles={[UserRole.TEACHER]} 
          />
        } 
      />
      <Route 
        path="/teacher/appointments" 
        element={
          <ProtectedRoute 
            element={<TeacherAppointments />} 
            allowedRoles={[UserRole.TEACHER]} 
          />
        } 
      />
      <Route 
        path="/teacher/questionnaire-submission/:appointmentId?" 
        element={
          <ProtectedRoute 
            element={<TeacherQuestionnaireSubmission />} 
            allowedRoles={[UserRole.TEACHER]} 
          />
        } 
      />

      {/* Manager routes */}
      <Route 
        path="/manager/appointments" 
        element={
          <ProtectedRoute 
            element={<ManagerAppointments />} 
            allowedRoles={[UserRole.MANAGER]} 
          />
        } 
      />
      <Route 
        path="/manager/assign-teacher/:id" 
        element={
          <ProtectedRoute 
            element={<AssignTeacher />} 
            allowedRoles={[UserRole.MANAGER]} 
          />
        } 
      />
      <Route 
        path="/manager/questionnaire" 
        element={
          <ProtectedRoute 
            element={<ManagerQuestionnaire />} 
            allowedRoles={[UserRole.MANAGER]} 
          />
        } 
      />

      <Route>404 - Not Found</Route>
    </Switch>
  );
}