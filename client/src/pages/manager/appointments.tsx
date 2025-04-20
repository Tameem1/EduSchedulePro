import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  User,
  Availability,
  Appointment,
  AppointmentStatusType,
  IndependentAssignment,
} from "@shared/schema";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format, startOfDay, endOfDay } from "date-fns";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelegramGuide } from "@/components/telegram/telegram-guide";

export default function ManagerAppointments() {
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] =
    React.useState<Appointment | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [isAddAppointmentDialogOpen, setIsAddAppointmentDialogOpen] =
    React.useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = React.useState<string>("");
  const [newAppointmentData, setNewAppointmentData] = React.useState({
    section: "",
    studentId: "",
    startTime: "",
    teacherAssignment: "",
  });
  const [filteredStudentsForAppointment, setFilteredStudentsForAppointment] = React.useState<User[]>([]);
  const { user } = useAuth();
  const [wsConnected, setWsConnected] = React.useState(false);
  const [wsRetries, setWsRetries] = React.useState(0);
  const maxRetries = 5;
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();
  const socketRef = React.useRef<WebSocket | null>(null);
  const [
    isAddIndependentAssignmentDialogOpen,
    setIsAddIndependentAssignmentDialogOpen,
  ] = React.useState(false);
  const [newIndependentAssignmentData, setNewIndependentAssignmentData] =
    React.useState({
      section: "",
      studentId: "",
      completionTime: "",
      assignment: "",
      notes: "",
    });
  const [filteredStudentsForIndependentAssignment, setFilteredStudentsForIndependentAssignment] = React.useState<User[]>([]);

  const connectWebSocket = React.useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any existing reconnection timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRetries >= maxRetries) {
      console.error("Max WebSocket reconnection attempts reached");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log(`Attempting WebSocket connection (attempt ${wsRetries + 1}):`, wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      setWsConnected(true);
      setWsRetries(0); // Reset retry counter on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "appointmentUpdate" ||
          data.type === "availabilityUpdate"
        ) {
          queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
          queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] });
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      setWsConnected(false);

      // Implement exponential backoff for reconnection
      const timeout = Math.min(1000 * Math.pow(2, wsRetries), 30000);
      console.log(`Scheduling reconnection in ${timeout}ms`);

      reconnectTimeoutRef.current = setTimeout(() => {
        setWsRetries(prev => prev + 1);
        connectWebSocket();
      }, timeout);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current = ws;
  }, [wsRetries]);

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

  const { data: teachers, isLoading: isLoadingTeachers } = useQuery<User[]>({
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

  const { data: students, isLoading: isLoadingStudents } = useQuery<User[]>({
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

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<
    Appointment[]
  >({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/appointments");
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user,
  });

  const { data: availabilities, isLoading: isLoadingAvailabilities } = useQuery<
    Availability[]
  >({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/availabilities");
      if (!res.ok) {
        throw new Error("Failed to fetch availabilities");
      }
      return res.json();
    },
    enabled: !!user,
  });
  
  const { data: sections, isLoading: isLoadingSections } = useQuery<string[]>({
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

  const { data: independentAssignments, isLoading: isLoadingIndependentAssignments } = useQuery<IndependentAssignment[]>({
    queryKey: ["/api/independent-assignments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/independent-assignments");
      if (!res.ok) {
        throw new Error("Failed to fetch independent assignments");
      }
      const assignments = await res.json();
      // Filter assignments for today only
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      return assignments.filter((assignment: IndependentAssignment) => {
        const assignmentDate = new Date(assignment.completionTime);
        return assignmentDate >= todayStart && assignmentDate <= todayEnd;
      });
    },
    enabled: !!user,
  });

  // Function to fetch students for a specific section
  const fetchStudentsBySection = async (section: string, forForm: 'appointment' | 'independent') => {
    try {
      if (!section) {
        if (forForm === 'appointment') {
          setFilteredStudentsForAppointment([]);
        } else {
          setFilteredStudentsForIndependentAssignment([]);
        }
        return;
      }
      
      const res = await apiRequest("GET", `/api/section/${section}/students`);
      if (!res.ok) {
        throw new Error(`Failed to fetch students for section ${section}`);
      }
      
      const sectionStudents = await res.json();
      console.log(`Fetched ${sectionStudents.length} students for section ${section}`);
      
      if (forForm === 'appointment') {
        setFilteredStudentsForAppointment(sectionStudents);
        setNewAppointmentData(prev => ({ ...prev, studentId: "" }));
      } else {
        setFilteredStudentsForIndependentAssignment(sectionStudents);
        setNewIndependentAssignmentData(prev => ({ ...prev, studentId: "" }));
      }
    } catch (error) {
      console.error("Error fetching students by section:", error);
      toast({
        title: "خطأ في جلب بيانات الطلاب",
        description: "حدث خطأ أثناء محاولة جلب بيانات الطلاب للقسم المختار",
        variant: "destructive",
      });
    }
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
      section: string;
      studentId: string;
      startTime: string;
      teacherAssignment: string;
    }) => {
      const localDate = new Date(data.startTime);
      const year = localDate.getFullYear();
      const month = localDate.getMonth();
      const day = localDate.getDate();
      const hours = localDate.getHours();
      const minutes = localDate.getMinutes();
      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, 0));

      const appointment = {
        studentId: parseInt(data.studentId),
        startTime: utcDate.toISOString(),
        teacherAssignment: data.teacherAssignment,
      };
      console.log("Sending appointment data:", appointment);

      const res = await apiRequest("POST", "/api/appointments", appointment);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الموعد",
        description: "تم إنشاء الموعد بنجاح",
      });
      setIsAddAppointmentDialogOpen(false);
      setNewAppointmentData({
        section: "",
        studentId: "",
        startTime: "",
        teacherAssignment: "",
      });
      setFilteredStudentsForAppointment([]);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إنشاء الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      teacherId,
      teacherAssignment,
    }: {
      appointmentId: number;
      teacherId: number;
      teacherAssignment: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        {
          teacherId,
          status: AppointmentStatus.REQUESTED,
          teacherAssignment,
        },
      );
      if (!res.ok) {
        throw new Error("Failed to assign teacher");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const notificationMessage = data.notificationSent
        ? "تم إرسال إشعار للمعلم عبر تيليجرام بنجاح"
        : "تم تعيين المعلم ولكن لم يتم إرسال إشعار تيليجرام";

      toast({
        title: "تم تعيين المعلم",
        description: notificationMessage,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsAssignDialogOpen(false);
      setSelectedAppointment(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ في تعيين المعلم",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createIndependentAssignmentMutation = useMutation({
    mutationFn: async (data: {
      section: string;
      studentId: string;
      completionTime: string;
      assignment: string;
      notes: string;
    }) => {
      const localDate = new Date(data.completionTime);
      const utcDate = new Date(
        Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          localDate.getHours(),
          localDate.getMinutes(),
          0,
        ),
      );

      const assignment = {
        studentId: parseInt(data.studentId),
        completionTime: utcDate.toISOString(),
        assignment: data.assignment,
        notes: data.notes,
      };

      const res = await apiRequest(
        "POST",
        "/api/independent-assignments",
        assignment,
      );
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(
          errJson.error || "Failed to create independent assignment",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إضافة المهمة المستقلة",
        description: "تم إضافة المهمة المستقلة بنجاح",
      });
      setIsAddIndependentAssignmentDialogOpen(false);
      setNewIndependentAssignmentData({
        section: "",
        studentId: "",
        completionTime: "",
        assignment: "",
        notes: "",
      });
      setFilteredStudentsForIndependentAssignment([]);
      queryClient.invalidateQueries({
        queryKey: ["/api/independent-assignments"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة المهمة المستقلة",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getUserName = (
    userId: number | null | undefined,
    role: "student" | "teacher",
  ) => {
    if (!userId) return ""; // or whatever fallback you prefer

    // If we’re in a Manager component, you likely have teachers[] and students[] fetched from the backend:
    const userList = role === "teacher" ? teachers : students;

    // Find the corresponding user:
    const foundUser = userList?.find((u) => u.id === userId);

    // Return the user’s name if found; otherwise fall back on "teacher 123" or "student 123"
    return foundUser?.username || `${role} ${userId}`;
  };

  // Filter teachers based on search query
  const getFilteredTeachers = React.useMemo(() => {
    if (!teachers) return [];
    if (!teacherSearchQuery.trim()) return teachers;
    
    return teachers.filter(teacher => 
      teacher.username?.toLowerCase().includes(teacherSearchQuery.toLowerCase())
    );
  }, [teachers, teacherSearchQuery]);

  const getStatusColor = (status: AppointmentStatusType) => {
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
  };

  if (
    !user ||
    user.role !== "manager" ||
    isLoadingTeachers ||
    isLoadingAppointments ||
    isLoadingStudents ||
    isLoadingIndependentAssignments
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto p-4">
      {/* Show Telegram Guide if manager doesn't have telegramUsername */}
      {user && user.role === 'manager' && !user.telegramUsername && (
        <TelegramGuide />
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">إدارة المواعيد</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddAppointmentDialogOpen(true)}>
            إضافة موعد
          </Button>
          <Button onClick={() => setIsAddIndependentAssignmentDialogOpen(true)}>
            إضافة مهمة مستقلة
          </Button>
          <Link href="/manager/results">
            <Button variant="outline">عرض النتائج</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>المواعيد</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المعلم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments?.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    {format(new Date(appointment.startTime), "h:mm a")}
                  </TableCell>
                  <TableCell>
                    {getUserName(appointment.studentId, "student")}
                  </TableCell>
                  <TableCell>
                    {getUserName(appointment.teacherId, "teacher")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(appointment.status)} text-white`}
                    >
                      {AppointmentStatusArabic[appointment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(appointment.status === AppointmentStatus.PENDING ||
                      appointment.status === AppointmentStatus.REJECTED) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        تعيين معلم
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>المهام المستقلة</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المهمة</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {independentAssignments?.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    {format(
                      new Date(assignment.completionTime),
                      "yyyy/MM/dd h:mm a",
                    )}
                  </TableCell>
                  <TableCell>
                    {getUserName(assignment.studentId, "student")}
                  </TableCell>
                  <TableCell>{assignment.assignment}</TableCell>
                  <TableCell>{assignment.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={isAddAppointmentDialogOpen}
        onOpenChange={setIsAddAppointmentDialogOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة موعد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اختر الفصل</Label>
              <Select
                value={newAppointmentData.section}
                onValueChange={(value) => {
                  setNewAppointmentData((prev) => ({
                    ...prev,
                    section: value,
                    studentId: "", // Reset student selection when section changes
                  }));
                  fetchStudentsBySection(value, 'appointment');
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
                value={newAppointmentData.studentId}
                onValueChange={(value) =>
                  setNewAppointmentData((prev) => ({
                    ...prev,
                    studentId: value,
                  }))
                }
                disabled={!newAppointmentData.section || filteredStudentsForAppointment.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!newAppointmentData.section ? "اختر الفصل أولاً" : "اختر الطالب"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudentsForAppointment.map((student) => (
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newAppointmentData.startTime}
                onChange={(e) =>
                  setNewAppointmentData((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>المهمة المطلوبة</Label>
              <Input
                value={newAppointmentData.teacherAssignment}
                onChange={(e) =>
                  setNewAppointmentData((prev) => ({
                    ...prev,
                    teacherAssignment: e.target.value,
                  }))
                }
                placeholder="أدخل المهمة المطلوبة من المعلم"
              />
            </div>

            <Button
              className="w-full"
              onClick={() =>
                createAppointmentMutation.mutate(newAppointmentData)
              }
              disabled={createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending
                ? "جاري الإنشاء..."
                : "إنشاء الموعد"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعيين معلم للموعد</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p>
                    الوقت:{" "}
                    {format(new Date(selectedAppointment.startTime), "HH:mm")}
                  </p>
                  <p>
                    الطالب:{" "}
                    {getUserName(selectedAppointment.studentId, "student")}
                  </p>
                </div>
                
                {/* Search input for teachers */}
                <div className="mb-4">
                  <Label htmlFor="teacher-search">بحث عن معلم</Label>
                  <div className="flex items-center relative">
                    <Input
                      id="teacher-search"
                      value={teacherSearchQuery}
                      onChange={(e) => setTeacherSearchQuery(e.target.value)}
                      placeholder="اكتب اسم المعلم للبحث"
                      className="pr-8"
                    />
                    <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {teachers && getFilteredTeachers.length < teachers.length && (
                    <p className="text-xs text-muted-foreground mt-1">
                      تم عرض {getFilteredTeachers.length} من أصل {teachers.length} معلم
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  {getFilteredTeachers.length > 0 ? (
                    <>
                      {getFilteredTeachers.map((teacher) => {
                        const isAvailable = availabilities?.some((avail) => {
                          const appointmentTime = new Date(
                            selectedAppointment.startTime,
                          );
                          const availStartTime = new Date(avail.startTime);
                          const availEndTime = new Date(avail.endTime);
                          return (
                            avail.teacherId === teacher.id &&
                            appointmentTime >= availStartTime &&
                            appointmentTime <= availEndTime
                          );
                        });

                        return (
                          <div
                            key={teacher.id}
                            className={`p-3 border rounded-lg cursor-pointer hover:bg-muted ${
                              isAvailable ? "border-green-500" : "border-gray-300"
                            }`}
                            onClick={() =>
                              assignTeacherMutation.mutate({
                                appointmentId: selectedAppointment.id,
                                teacherId: teacher.id,
                                teacherAssignment:
                                  selectedAppointment.teacherAssignment || "",
                              })
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span>{teacher.username}</span>
                              {isAvailable ? (
                                <Badge variant="default">متوفر</Badge>
                              ) : (
                                <Badge variant="secondary">غير متوفر</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="p-2 text-muted-foreground text-center">
                      لا يوجد معلمين مطابقين للبحث
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assignment">المهمة المطلوبة</Label>
                  <Input
                    id="assignment"
                    value={selectedAppointment.teacherAssignment || ""}
                    onChange={(e) => {
                      setSelectedAppointment({
                        ...selectedAppointment,
                        teacherAssignment: e.target.value,
                      });
                    }}
                    placeholder="أدخل المهمة المطلوبة من المعلم"
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddIndependentAssignmentDialogOpen}
        onOpenChange={setIsAddIndependentAssignmentDialogOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة مهمة مستقلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اختر الفصل</Label>
              <Select
                value={newIndependentAssignmentData.section}
                onValueChange={(value) => {
                  setNewIndependentAssignmentData((prev) => ({
                    ...prev,
                    section: value,
                    studentId: "", // Reset student selection when section changes
                  }));
                  fetchStudentsBySection(value, 'independent');
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
                value={newIndependentAssignmentData.studentId}
                onValueChange={(value) =>
                  setNewIndependentAssignmentData((prev) => ({
                    ...prev,
                    studentId: value,
                  }))
                }
                disabled={!newIndependentAssignmentData.section || filteredStudentsForIndependentAssignment.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!newIndependentAssignmentData.section ? "اختر الفصل أولاً" : "اختر الطالب"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudentsForIndependentAssignment.map((student) => (
                    <SelectItem key={student.id} value={String(student.id)}>
                      {student.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>وقت الإكمال</Label>
              <input
                type="datetime-local"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newIndependentAssignmentData.completionTime}
                onChange={(e) =>
                  setNewIndependentAssignmentData((prev) => ({
                    ...prev,
                    completionTime: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>المهمة المنجزة</Label>
              <Input
                value={newIndependentAssignmentData.assignment}
                onChange={(e) =>
                  setNewIndependentAssignmentData((prev) => ({
                    ...prev,
                    assignment: e.target.value,
                  }))
                }
                placeholder="أدخل وصف المهمة المنجزة"
              />
            </div>

            <div>
              <Label>ملاحظات إضافية</Label>
              <Input
                value={newIndependentAssignmentData.notes}
                onChange={(e) =>
                  setNewIndependentAssignmentData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="أدخل أي ملاحظات إضافية"
              />
            </div>

            <Button
              className="w-full"
              onClick={() =>
                createIndependentAssignmentMutation.mutate(
                  newIndependentAssignmentData,
                )
              }
              disabled={createIndependentAssignmentMutation.isPending}
            >
              {createIndependentAssignmentMutation.isPending
                ? "جاري الإضافة..."
                : "إضافة المهمة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}