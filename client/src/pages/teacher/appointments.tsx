import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { TelegramGuide } from "@/components/telegram/telegram-guide";

// shadcn/ui dialog + select + label
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


function getStatusColor(status: AppointmentStatusType) {
  return (
    {
      [AppointmentStatus.PENDING]: "bg-gray-500",
      [AppointmentStatus.REQUESTED]: "bg-blue-500",
      [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
      [AppointmentStatus.RESPONDED]: "bg-green-500",
      [AppointmentStatus.DONE]: "bg-purple-500",
      [AppointmentStatus.REJECTED]: "bg-red-500",
      [AppointmentStatus.NOT_ATTENDED]: "bg-orange-500",
    }[status] || "bg-gray-500"
  );
}

export default function TeacherAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSection, setSelectedSection] = React.useState("");
  const [filteredStudents, setFilteredStudents] = React.useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [teacherAssignment, setTeacherAssignment] = React.useState(""); 
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const socketRef = React.useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();

  // WebSocket connection setup
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
        console.log("WebSocket message received:", data);
        if (data.type === 'appointmentUpdate') {
          console.log("Appointment update received, refreshing appointments data");
          queryClient.invalidateQueries({ 
            queryKey: ["/api/teachers", user?.id, "appointments"] 
          });
          
          // Show a toast notification about the assignment change
          if (data.data?.action === "update" && data.data?.appointment?.teacherAssignment) {
            const appt = data.data.appointment;
            if (appt.teacherId === user?.id) {
              toast({
                title: "تم تحديث المهمة المطلوبة",
                description: `تم تغيير المهمة المطلوبة للموعد إلى: ${appt.teacherAssignment}`,
                variant: "default",
              });
            }
          }
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
  }, [user?.id]);

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

  // Data fetching
  const { data: sections, isLoading: loadingSections } = useQuery<string[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sections");
      if (!res.ok) {
        throw new Error("Failed to fetch sections");
      }
      return res.json();
    },
    enabled: !!user,
  });

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
  
  // Function to fetch students for the selected section
  const fetchStudentsBySection = async (section: string) => {
    try {
      if (!section) {
        setFilteredStudents([]);
        setSelectedStudent("");
        return;
      }
      
      const res = await apiRequest("GET", `/api/section/${section}/students`);
      if (!res.ok) {
        throw new Error(`Failed to fetch students for section ${section}`);
      }
      
      const sectionStudents = await res.json();
      console.log(`Fetched ${sectionStudents.length} students for section ${section}`);
      setFilteredStudents(sectionStudents);
      setSelectedStudent("");
    } catch (error) {
      console.error("Error fetching students by section:", error);
      toast({
        title: "خطأ في جلب بيانات الطلاب",
        description: "حدث خطأ أثناء محاولة جلب بيانات الطلاب للقسم المختار",
        variant: "destructive",
      });
    }
  };

  const { data: appointments, isLoading: loadingAppointments, error: appointmentsError } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Create new appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: { studentId: number; startTime: string; teacherAssignment: string }) => {
      console.log("Creating appointment with data:", data); // Add debug log
      const res = await apiRequest("POST", "/api/appointments", data);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الموعد",
        description: "تم إنشاء الموعد بنجاح وإرساله للمدير للموافقة",
      });
      setIsDialogOpen(false);
      setSelectedSection("");
      setSelectedStudent("");
      setStartTime("");
      setTeacherAssignment(""); 
      setFilteredStudents([]);
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "appointments"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إنشاء الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add mutation for accepting/rejecting appointments
  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: number; status: AppointmentStatusType }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        { status }
      );
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update appointment status");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      const action = variables.status === AppointmentStatus.ASSIGNED ? "قبول" : "رفض";
      toast({
        title: `تم ${action} الموعد`,
        description: `تم ${action} الموعد بنجاح`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "appointments"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تحديث حالة الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleCreateAppointment() {
    if (!selectedStudent || !startTime) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار الطالب وتحديد الوقت",
        variant: "destructive",
      });
      return;
    }
    console.log("Submitting appointment with assignment:", teacherAssignment); // Add debug log
    createAppointmentMutation.mutate({
      studentId: parseInt(selectedStudent),
      startTime,
      teacherAssignment,
    });
  }

  // Helper to get student name
  function getStudentName(id: number) {
    if (!students) return `طالب #${id}`;
    const stu = students.find((s) => s.id === id);
    return stu ? stu.username : `طالب #${id}`;
  }

  // Must be teacher
  if (!user || user.role !== UserRole.TEACHER) {
    return (
      <div className="p-4">
        <p>غير مصرح لك بالوصول لهذه الصفحة.</p>
      </div>
    );
  }

  if (loadingAppointments || loadingStudents || loadingSections) {
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
              {appointmentsError instanceof Error ? appointmentsError.message : "حدث خطأ في تحميل المواعيد"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Show Telegram Guide if teacher doesn't have telegramUsername */}
      {user && user.role === 'teacher' && !user.telegramUsername && (
        <TelegramGuide />
      )}
      
      {/* Top actions: availability, created appointments, plus button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">مواعيد المعلم</h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/availability" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">إدارة التوفر</Button>
          </Link>
          
          <Link href="/teacher/created-appointments" className="w-full sm:w-auto">
            <Button 
              variant="secondary" 
              className="w-full sm:w-auto flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 ml-1">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" x2="16" y1="2" y2="6"></line>
                <line x1="8" x2="8" y1="2" y2="6"></line>
                <line x1="3" x2="21" y1="10" y2="10"></line>
                <path d="M8 14h.01"></path>
                <path d="M12 14h.01"></path>
                <path d="M16 14h.01"></path>
                <path d="M8 18h.01"></path>
                <path d="M12 18h.01"></path>
                <path d="M16 18h.01"></path>
              </svg>
              المواعيد التي أنشأتها
            </Button>
          </Link>

          {/* Button+Dialog to add new appointment */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">إضافة موعد لطالب</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة موعد جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>اختر الفصل</Label>
                  <Select
                    value={selectedSection}
                    onValueChange={(val) => {
                      setSelectedSection(val);
                      setSelectedStudent("");
                      fetchStudentsBySection(val);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفصل" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections?.map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>اختر الطالب</Label>
                  <Select
                    value={selectedStudent}
                    onValueChange={(val) => setSelectedStudent(val)}
                    disabled={!selectedSection || filteredStudents.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedSection ? "اختر الفصل أولاً" : "اختر الطالب"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={String(student.id)}>
                          {student.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>وقت الموعد</Label>
                  <input
                    type="datetime-local"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                {/* Add new input field for teacherAssignment */}
                <div>
                  <Label>المهمة المطلوبة</Label>
                  <Input
                    value={teacherAssignment}
                    onChange={(e) => setTeacherAssignment(e.target.value)}
                    placeholder="أدخل المهمة المطلوبة من الطالب"
                  />
                </div>

                <Button
                  onClick={handleCreateAppointment}
                  disabled={createAppointmentMutation.isPending}
                  className="w-full"
                >
                  {createAppointmentMutation.isPending
                    ? "جاري الإنشاء..."
                    : "إنشاء الموعد"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Display teacher's appointments */}
      {appointments && appointments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>مواعيدي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Appointment info */}
                  <div>
                    <p className="font-medium">
                      {formatGMT3Time(new Date(appointment.startTime))}
                      {"  "}
                      <span className="text-sm text-muted-foreground ml-2">
                        {format(parseISO(appointment.startTime), "MMM d, yyyy")}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      الطالب: {getStudentName(appointment.studentId)}
                    </p>

                    <Badge
                      className={`mt-2 text-white ${getStatusColor(appointment.status)}`}
                    >
                      {AppointmentStatusArabic[appointment.status]}
                    </Badge>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {appointment.status === AppointmentStatus.REQUESTED && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateAppointmentStatusMutation.mutate({
                              appointmentId: appointment.id,
                              status: AppointmentStatus.ASSIGNED,
                            })
                          }
                          disabled={updateAppointmentStatusMutation.isPending}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          قبول
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateAppointmentStatusMutation.mutate({
                              appointmentId: appointment.id,
                              status: AppointmentStatus.REJECTED,
                            })
                          }
                          disabled={updateAppointmentStatusMutation.isPending}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                        >
                          <X className="w-4 h-4 mr-1" />
                          رفض
                        </Button>
                      </>
                    )}

                    {appointment.status !== AppointmentStatus.REJECTED && (
                      <Link
                        href={`/teacher/questionnaire-submission/${appointment.id}`}
                        className="w-full sm:w-auto"
                      >
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          املأ الاستبيان
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
          <CardContent>
            <p className="text-center text-muted-foreground">
              ليس لديك مواعيد حاليًا
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}