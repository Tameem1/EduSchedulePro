import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isToday } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { formatGMT3Time } from "@/lib/date-utils";
import { Loader2, CalendarIcon, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
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
  
  // Get all teachers for displaying names 
  const { data: teachers } = useQuery<User[]>({
    queryKey: ["/api/users/teachers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/teachers");
      if (!res.ok) {
        throw new Error("Failed to fetch teachers");
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
  
  // Helper to get teacher name
  function getTeacherName(id: number) {
    if (!teachers) return `معلم #${id}`;
    const teacher = teachers.find((t) => t.id === id);
    return teacher ? teacher.username : `معلم #${id}`;
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
  
  // Filter appointments for today only
  const todayAppointments = React.useMemo(() => {
    if (!createdAppointments) return [];
    return createdAppointments.filter(appointment => 
      isToday(new Date(appointment.startTime))
    );
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
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4 ml-1" />
              العودة إلى المواعيد
            </Button>
          </Link>
        </div>
      </div>

      {todayAppointments && todayAppointments.length > 0 ? (
        <Card className="border-t-4" style={{ borderTopColor: "hsl(222.2 47.4% 11.2%)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              المواعيد التي قمت بإنشائها اليوم
            </CardTitle>
            <CardDescription>
              هنا يمكنك رؤية المواعيد التي قمت بإنشائها للطلاب اليوم
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.length > 0 ? (
                todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border rounded-lg transition-colors duration-200"
                    style={{ borderColor: "#e2e8f0" }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "hsl(222.2 47.4% 11.2%)"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                          <p className="font-medium text-lg">
                            {formatGMT3Time(new Date(appointment.startTime))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(appointment.startTime), "EEEE, d MMMM yyyy")}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <p className="text-sm">
                            <span className="font-medium">الطالب:</span> {getStudentName(appointment.studentId)}
                          </p>
                          
                          {appointment.teacherId && (
                            <p className="text-sm">
                              <span className="font-medium">المعلم المعين:</span> {getTeacherName(appointment.teacherId)}
                            </p>
                          )}
                        </div>
                        
                        {appointment.teacherAssignment && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">المهمة:</span> {appointment.teacherAssignment}
                          </p>
                        )}
                        
                        {/* Display questionnaire response question3 for completed appointments */}
                        {appointment.status === AppointmentStatus.DONE && 
                         questionnaireResponses[appointment.id]?.question3 && (
                          <p className="text-sm mt-2 p-2 bg-muted rounded-md">
                            <span className="font-medium">ماذا سمع الطالب:</span> {questionnaireResponses[appointment.id]?.question3}
                          </p>
                        )}
                        
                        <div className="mt-3">
                          <Badge className={`text-white ${getStatusColor(appointment.status)}`}>
                            {AppointmentStatusArabic[appointment.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  لا توجد مواعيد اليوم
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لم تقم بإنشاء أي مواعيد اليوم</p>
            <p className="mt-2">يمكنك إنشاء مواعيد جديدة من صفحة المواعيد</p>
            <Link href="/teacher/appointments">
              <Button 
                variant="outline" 
                className="mt-4"
              >
                العودة إلى المواعيد
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}