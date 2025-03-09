import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import BookAppointment from "@/pages/student/book-appointment";
import TeacherAvailability from "@/pages/teacher/availability";
import TeacherQuestionnaire from "@/pages/teacher/questionnaire";
import ManagerAppointments from "@/pages/manager/appointments";
import ManagerResults from "@/pages/manager/results";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute 
        path="/" 
        role="student" 
        component={BookAppointment} 
      />
      <ProtectedRoute
        path="/teacher/availability"
        role="teacher"
        component={TeacherAvailability}
      />
      <ProtectedRoute
        path="/teacher/questionnaire"
        role="teacher"
        component={TeacherQuestionnaire}
      />
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
      <Route component={NotFound} />
    </Switch>
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
