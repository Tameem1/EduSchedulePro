import { createBrowserRouter, Navigate } from "react-router-dom";
import { UserRole } from "@shared/schema";
import AuthPage from "./pages/auth-page";
import BookAppointment from "./pages/student/book-appointment";
import StudentAppointments from "./pages/student/appointments";
import TeacherAvailability from "./pages/teacher/availability";
import TeacherAppointments from "./pages/teacher/appointments";
import TeacherQuestionnaireSubmission from "./pages/teacher/questionnaire-submission";
import ManagerAppointments from "./pages/manager/appointments";
import AssignTeacher from "./pages/manager/assign-teacher";
import Dashboard from "./pages/dashboard";
import RootLayout from "./layouts/root-layout";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({
  element,
  allowedRoles,
}: {
  element: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Redirect if user is not logged in or doesn't have permission
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth" replace />;
  }

  return element;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "auth",
        element: <AuthPage />,
      },
      // Student routes
      {
        path: "student/book-appointment",
        element: (
          <ProtectedRoute
            element={<BookAppointment />}
            allowedRoles={[UserRole.STUDENT]}
          />
        ),
      },
      {
        path: "student/appointments",
        element: (
          <ProtectedRoute
            element={<StudentAppointments />}
            allowedRoles={[UserRole.STUDENT]}
          />
        ),
      },
      // Teacher routes
      {
        path: "teacher/availability",
        element: (
          <ProtectedRoute
            element={<TeacherAvailability />}
            allowedRoles={[UserRole.TEACHER]}
          />
        ),
      },
      {
        path: "teacher/appointments",
        element: (
          <ProtectedRoute
            element={<TeacherAppointments />}
            allowedRoles={[UserRole.TEACHER]}
          />
        ),
      },
      // The new route for the questionnaire submission:
      {
        path: "teacher/questionnaire-submission/:appointmentId",
        element: (
          <ProtectedRoute
            element={<TeacherQuestionnaireSubmission />}
            allowedRoles={[UserRole.TEACHER]}
          />
        ),
      },
      // Manager routes
      {
        path: "manager/appointments",
        element: (
          <ProtectedRoute
            element={<ManagerAppointments />}
            allowedRoles={[UserRole.MANAGER]}
          />
        ),
      },
      {
        path: "manager/assign-teacher/:appointmentId",
        element: (
          <ProtectedRoute
            element={<AssignTeacher />}
            allowedRoles={[UserRole.MANAGER]}
          />
        ),
      },
    ],
  },
]);
