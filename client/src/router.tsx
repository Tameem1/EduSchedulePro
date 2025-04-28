import * as React from "react";
import { Switch, Route } from "wouter";
import { UserRole } from "@shared/schema";
import { ProtectedRoute } from "./lib/protected-route";
import { Navbar } from "@/components/Navbar";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import BookAppointment from "@/pages/student/book-appointment";
import StudentAppointments from "@/pages/student/appointments";
import TeacherAvailability from "@/pages/teacher/availability";
import TeacherAppointments from "@/pages/teacher/appointments";
import TeacherCreatedAppointments from "@/pages/teacher/created-appointments";
import TeacherCreated from "@/pages/teacher/created";
import TeacherQuestionnaireSubmission from "@/pages/teacher/questionnaire-submission";
import ManagerAppointments from "@/pages/manager/appointments";
import AssignTeacher from "@/pages/manager/assign-teacher";
import ManagerQuestionnaire from "@/pages/manager/questionnaire";
import ManagerTeachersAvailability from "@/pages/manager/teachers-availability";

export default function Router() {
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
        <Route path="/teacher/created-appointments">
          <TeacherCreatedAppointments />
        </Route>
        <Route path="/teacher/created">
          <TeacherCreated />
        </Route>
        <ProtectedRoute
          path="/teacher/questionnaire-submission/:appointmentId?"
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
        <ProtectedRoute
          path="/"
          role="student"
          component={() => {
            window.location.href = "/student/book-appointment";
            return <div>Redirecting...</div>;
          }}
        />

        <Route component={NotFound} />
      </Switch>
    </>
  );
}