import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { formatGMT3Time } from "@/lib/date-utils";
import { Loader2, CalendarIcon, ArrowLeft } from "lucide-react";
import { 
  AppointmentStatus, 
  AppointmentStatusArabic, 
  type Appointment,
  type User,
  type QuestionnaireResponse
} from "@shared/schema";

// UI Components
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Helper function to determine status color
function getStatusColor(status: string) {
  return {
    [AppointmentStatus.PENDING]: "bg-gray-400",
    [AppointmentStatus.REQUESTED]: "bg-blue-500",
    [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
    [AppointmentStatus.RESPONDED]: "bg-green-500",
    [AppointmentStatus.DONE]: "bg-purple-500",
    [AppointmentStatus.REJECTED]: "bg-red-500",
  }[status] || "bg-gray-500";
}

export default function TeacherCreatedAppointments() {
  const { user } = useAuth();
  
  // Debug log to track component mounting
  React.useEffect(() => {
    console.log("Created appointments page loaded successfully!");
    
    return () => {
      console.log("TeacherCreatedAppointments component unmounted");
    };
  }, [user]);

  // Get appointments created by the teacher
  const { data: createdAppointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "created-appointments"],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const res = await apiRequest(
        "GET", 
        `/api/teachers/${user.id}/created-appointments`
      );
      
      if (!res.ok) {
        throw new Error("Failed to fetch created appointments");
      }
      
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Get all students for displaying names
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      return res.json();
    },
    enabled: !!user,
  });
  
  // Function to get questionnaire response for an appointment
  const getQuestionnaireResponse = async (appointmentId: number) => {
    try {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}/questionnaire`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error("Error fetching questionnaire response:", error);
      return null;
    }
  };

  // Helper to get student name
  function getStudentName(id: number) {
    if (!students) return `طالب #${id}`;
    const student = students.find((s) => s.id === id);
    return student ? student.username : `طالب #${id}`;
  }

  // Track questionnaire responses
  const [questionnaireResponses, setQuestionnaireResponses] = React.useState<Record<number, QuestionnaireResponse | null>>({});
  
  // Fetch questionnaire responses for completed appointments
  React.useEffect(() => {
    if (!createdAppointments) return;
    
    const fetchQuestionnaireResponses = async () => {
      const doneAppointments = createdAppointments.filter(
        appointment => appointment.status === AppointmentStatus.DONE
      );
      
      const responses: Record<number, QuestionnaireResponse | null> = {};
      
      for (const appointment of doneAppointments) {
        const response = await getQuestionnaireResponse(appointment.id);
        responses[appointment.id] = response;
      }
      
      setQuestionnaireResponses(responses);
    };
    
    fetchQuestionnaireResponses();
  }, [createdAppointments]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center gap-4 mb-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">
          المواعيد التي أنشأتها
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto flex items-center gap-1"
            onClick={() => {
              console.log("Navigating back to appointments");
              window.location.href = "/teacher/appointments";
            }}
          >
            <ArrowLeft className="h-4 w-4 ml-1" />
            العودة إلى المواعيد
          </Button>
        </div>
      </div>

      {createdAppointments && createdAppointments.length > 0 ? (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              المواعيد التي قمت بإنشائها
            </CardTitle>
            <CardDescription>
              هنا يمكنك رؤية جميع المواعيد التي قمت بإنشائها للطلاب
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {createdAppointments.length > 0 ? (
                createdAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border rounded-lg hover:border-primary transition-colors duration-200"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                          <p className="font-medium text-lg">
                            {formatGMT3Time(new Date(appointment.startTime))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(appointment.startTime), "EEEE, d MMMM yyyy")}
                          </p>
                        </div>
                        
                        <p className="text-sm mt-2">
                          <span className="font-medium">الطالب:</span> {getStudentName(appointment.studentId)}
                        </p>
                        
                        {appointment.teacherAssignment && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">المهمة:</span> {appointment.teacherAssignment}
                          </p>
                        )}
                        
                        {/* Display questionnaire response question3 for completed appointments */}
                        {appointment.status === AppointmentStatus.DONE && 
                         questionnaireResponses[appointment.id]?.question3 && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">ماذا سيفعل الطالب:</span> {questionnaireResponses[appointment.id]?.question3}
                          </p>
                        )}
                        
                        <div className="mt-3">
                          <Badge className={`text-white ${getStatusColor(appointment.status)}`}>
                            {AppointmentStatusArabic[appointment.status]}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {appointment.status !== AppointmentStatus.REJECTED && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              console.log("Navigating to questionnaire submission");
                              window.location.href = `/teacher/questionnaire-submission/${appointment.id}`;
                            }}
                          >
                            استعراض الاستبيان
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  لا توجد مواعيد
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لم تقم بإنشاء أي مواعيد بعد</p>
            <p className="mt-2">يمكنك إنشاء مواعيد جديدة من صفحة المواعيد</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                console.log("Navigating back to appointments");
                window.location.href = "/teacher/appointments";
              }}
            >
              العودة إلى المواعيد
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}