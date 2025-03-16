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
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  User,
  Availability,
  Appointment,
  AppointmentStatusType,
} from "@shared/schema";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
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

export default function ManagerAppointments() {
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] =
    React.useState<Appointment | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [isAddAppointmentDialogOpen, setIsAddAppointmentDialogOpen] = React.useState(false);
  const [newAppointmentData, setNewAppointmentData] = React.useState({
    studentId: "",
    startTime: "",
    teacherAssignment: "",
  });
  const { user } = useAuth();
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

  // Existing queries remain unchanged
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

  // New mutation for creating appointments
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
      studentId: string;
      startTime: string;
      teacherAssignment: string;
    }) => {
      const res = await apiRequest("POST", "/api/manager/appointments", {
        studentId: parseInt(data.studentId),
        startTime: data.startTime,
        teacherAssignment: data.teacherAssignment,
      });
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
        studentId: "",
        startTime: "",
        teacherAssignment: "",
      });
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

  // Existing assignTeacherMutation remains unchanged
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

  // Helper functions remain unchanged
  const getUserName = (
    userId: number | null | undefined,
    role: "student" | "teacher",
  ) => {
    if (!userId) return role === "teacher" ? "لم يتم التعيين" : "غير معروف";
    const userList = role === "student" ? students : teachers;
    const user = userList?.find((u) => u.id === userId);
    return user?.username || `${role} ${userId}`;
  };

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

  // Show loading state while checking authentication and loading initial data
  if (
    !user ||
    user.role !== "manager" ||
    isLoadingTeachers ||
    isLoadingAppointments ||
    isLoadingStudents
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">إدارة المواعيد</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddAppointmentDialogOpen(true)}>
            إضافة موعد
          </Button>
          <Link href="/manager/questionnaire">
            <Button variant="secondary">إضافة نتيجة استبيان</Button>
          </Link>
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

      {/* Add Appointment Dialog */}
      <Dialog
        open={isAddAppointmentDialogOpen}
        onOpenChange={setIsAddAppointmentDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موعد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الطالب" />
                </SelectTrigger>
                <SelectContent>
                  {students?.map((student) => (
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
              onClick={() => createAppointmentMutation.mutate(newAppointmentData)}
              disabled={createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending
                ? "جاري الإنشاء..."
                : "إنشاء الموعد"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Assign Teacher Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
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
                <div className="space-y-2">
                  {teachers?.map((teacher) => {
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
    </div>
  );
}