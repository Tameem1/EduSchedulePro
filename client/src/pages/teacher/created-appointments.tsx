import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import {
  AppointmentStatus,
  AppointmentStatusArabic,
  UserRole,
  type Appointment,
  type User,
  type AppointmentStatusType,
} from "@shared/schema";
import { formatGMT3Time } from "@/lib/date-utils";

function getStatusColor(status: AppointmentStatusType) {
  return (
    {
      [AppointmentStatus.PENDING]: "bg-gray-500",
      [AppointmentStatus.REQUESTED]: "bg-blue-500",
      [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
      [AppointmentStatus.RESPONDED]: "bg-green-500",
      [AppointmentStatus.DONE]: "bg-purple-500",
      [AppointmentStatus.REJECTED]: "bg-red-500",
    }[status] || "bg-gray-500"
  );
}

export default function TeacherCreatedAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = React.useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Debug log to track component mounting
  React.useEffect(() => {
    console.log("TeacherCreatedAppointments component mounted");
    console.log("Current user:", user);
    
    return () => {
      console.log("TeacherCreatedAppointments component unmounted");
    };
  }, [user]);

  // WebSocket connection setup for real-time updates
  const connectWebSocket = React.useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log("Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointmentUpdate') {
          // Refresh the data when we get an update
          console.log("Appointment update received, refreshing data");
          refetch();
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    socketRef.current = ws;
  }, []);

  React.useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Fetch students for displaying names
  const { data: students, isLoading: loadingStudents } = useQuery<User[]>({
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

  // Fetch appointments created by this teacher
  const { data: createdAppointments, isLoading: loadingAppointments, error: appointmentsError, refetch } = useQuery<Appointment[]>({
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

  // Helper to get student name
  function getStudentName(id: number) {
    if (!students) return `طالب #${id}`;
    const stu = students.find((s) => s.id === id);
    return stu ? stu.username : `طالب #${id}`;
  }

  // Helper to get teacher name (for display purposes)
  function getTeacherName(id: number | null) {
    if (!id) return "غير معين";
    if (id === user?.id) return "أنت";
    return `معلم #${id}`; // In a real scenario, you'd fetch the teacher's name
  }

  // Access control - only teachers can view this page
  if (!user || user.role !== UserRole.TEACHER) {
    return (
      <div className="p-4">
        <p>غير مصرح لك بالوصول لهذه الصفحة.</p>
      </div>
    );
  }

  if (loadingAppointments || loadingStudents) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (appointmentsError) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent>
            <p className="text-center text-muted-foreground">
              {appointmentsError instanceof Error 
                ? appointmentsError.message 
                : "حدث خطأ في تحميل المواعيد"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Top actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">
          المواعيد التي أنشأتها
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              العودة إلى المواعيد
            </Button>
          </Link>
        </div>
      </div>

      {/* Display created appointments */}
      {createdAppointments && createdAppointments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>المواعيد التي أنشأتها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {createdAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Appointment info */}
                  <div className="space-y-2">
                    <p className="font-medium">
                      {formatGMT3Time(new Date(appointment.startTime))}
                      {"  "}
                      <span className="text-sm text-muted-foreground ml-2">
                        {format(parseISO(appointment.startTime), "MMM d, yyyy")}
                      </span>
                    </p>
                    <p className="text-sm">
                      الطالب: <span className="font-medium">{getStudentName(appointment.studentId)}</span>
                    </p>
                    {appointment.teacherId && (
                      <p className="text-sm">
                        المعلم المعين: <span className="font-medium">{getTeacherName(appointment.teacherId)}</span>
                      </p>
                    )}
                    {appointment.teacherAssignment && (
                      <p className="text-sm">
                        المهمة: <span className="font-medium">{appointment.teacherAssignment}</span>
                      </p>
                    )}
                    <Badge
                      className={`text-white ${getStatusColor(appointment.status)}`}
                    >
                      {AppointmentStatusArabic[appointment.status]}
                    </Badge>
                  </div>

                  {/* Action buttons based on status */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                    {/* View questionnaire responses if appointment is DONE */}
                    {appointment.status === AppointmentStatus.DONE && (
                      <Link 
                        href={`/teacher/questionnaire-submission?appointmentId=${appointment.id}`}
                      >
                        <Button variant="outline" size="sm">
                          عرض الاستبيان
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">لم تقم بإنشاء أي مواعيد بعد.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}