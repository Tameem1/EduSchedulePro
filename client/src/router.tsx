import * as React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { Navbar } from "@/components/Navbar";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import BookAppointment from "@/pages/student/book-appointment";
import StudentAppointments from "@/pages/student/appointments";
import TeacherAvailability from "@/pages/teacher/availability";
import TeacherAppointments from "@/pages/teacher/appointments";
import TeacherCreatedAppointments from "@/pages/teacher/created-appointments";
import TeacherQuestionnaireSubmission from "@/pages/teacher/questionnaire-submission";
import ManagerAppointments from "@/pages/manager/appointments";
import AssignTeacher from "@/pages/manager/assign-teacher";
import ManagerQuestionnaire from "@/pages/manager/questionnaire";
import ManagerTeachersAvailability from "@/pages/manager/teachers-availability";


export default function Router() {
  console.log("Router component initialized");
  
  React.useEffect(() => {
    console.log("Current path:", window.location.pathname);
  }, []);

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
          path="/teacher/created-appointments"
          role="teacher"
          component={TeacherCreatedAppointments}
        />
        <ProtectedRoute
          path="/teacher/questionnaire-submission/:appointmentId"
          role="teacher"
          component={TeacherQuestionnaireSubmission}
        />

        {/* Manager routes */}
        <ProtectedRoute
          path="/manager/appointments"
          role="manager"
          component={ManagerAppointments}
        />
        <ProtectedRoute
          path="/manager/assign-teacher/:id"
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

        {/* Redirect root to appropriate dashboard */}
        <Route path="/">
          {() => {
            const { user } = useAuth();
            
            if (user) {
              if (user.role === UserRole.STUDENT) {
                return <Redirect to="/student/appointments" />;
              } else if (user.role === UserRole.TEACHER) {
                return <Redirect to="/teacher/appointments" />;
              } else if (user.role === UserRole.MANAGER) {
                return <Redirect to="/manager/appointments" />;
              }
            }
            
            return <Redirect to="/auth" />;
          }}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}