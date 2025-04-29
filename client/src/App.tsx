import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
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
        
        {/* Redirect root to appropriate dashboard */}
        <ProtectedRoute
          path="/"
          role="teacher"
          component={() => {
            console.log("Teacher root redirect - redirecting to /teacher/appointments");
            window.location.href = "/teacher/appointments";
            // Return an empty div to satisfy the return type requirement
            return <div style={{ display: 'none' }}></div>;
          }}
        />
        
        {/* Add explicit redirect from /teacher to appointments */}
        <ProtectedRoute
          path="/teacher"
          role="teacher"
          component={() => {
            console.log("Teacher base path redirect - redirecting to /teacher/appointments");
            window.location.href = "/teacher/appointments";
            // Return an empty div to satisfy the return type requirement
            return <div style={{ display: 'none' }}></div>;
          }}
        />

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
