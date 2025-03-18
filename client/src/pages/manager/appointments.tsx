import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentStatus, type Appointment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
import type {
  User,
  Availability,
  AppointmentStatusType,
  IndependentAssignment,
} from "@shared/schema";
import { AppointmentStatusArabic } from "@shared/schema";


export default function ManagerAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [isAddAppointmentDialogOpen, setIsAddAppointmentDialogOpen] = React.useState(false);
  const [newAppointmentData, setNewAppointmentData] = React.useState({
    studentId: "",
    startTime: "",
    teacherAssignment: "",
  });
  const socketRef = React.useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();
  const [isAddIndependentAssignmentDialogOpen, setIsAddIndependentAssignmentDialogOpen] = React.useState(false);
  const [newIndependentAssignmentData, setNewIndependentAssignmentData] = React.useState({
    studentId: "",
    completionTime: "",
    assignment: "",
    notes: "",
  });

  // Add proper data fetching
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiRequest("/api/users/teachers"),
  });

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => apiRequest("/api/users/students"),
  });

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => apiRequest("/api/appointments"),
  });

  const { data: independentAssignments, isLoading: isLoadingIndependentAssignments } = useQuery({
    queryKey: ["independentAssignments"],
    queryFn: () => apiRequest("/api/independent-assignments"),
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

  const getUsername = (userId: number | null | undefined, role: "student" | "teacher") => {
    if (!userId) return role;
    const userList = role === "student" ? students : teachers;
    const user = userList?.find((u) => u.id === userId);
    return user?.username || `${role} ${userId}`;
  };

  const getStatusColor = (status: string) => {
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
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["availabilities"] });
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


  const createAppointmentMutation = useMutation({
    mutationFn: async (data: {
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
        studentId: "",
        startTime: "",
        teacherAssignment: "",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
      studentId: string;
      completionTime: string;
      assignment: string;
      notes: string;
    }) => {
      const localDate = new Date(data.completionTime);
      const utcDate = new Date(Date.UTC(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes(),
        0
      ));

      const assignment = {
        studentId: parseInt(data.studentId),
        completionTime: utcDate.toISOString(),
        assignment: data.assignment,
        notes: data.notes,
      };

      const res = await apiRequest("POST", "/api/independent-assignments", assignment);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create independent assignment");
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
        studentId: "",
        completionTime: "",
        assignment: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["independentAssignments"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة المهمة المستقلة",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (
    !user ||
    user.role !== "manager" ||
    isLoadingTeachers ||
    isLoadingAppointments ||
    isLoadingStudents ||
    isLoadingIndependentAssignments || isLoadingAvailabilities
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
          <Button onClick={() => setIsAddIndependentAssignmentDialogOpen(true)}>
            إضافة مهمة مستقلة
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
                    {getUsername(appointment.studentId, "student")}
                  </TableCell>
                  <TableCell>
                    {getUsername(appointment.teacherId, "teacher")}
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
                    {format(new Date(assignment.completionTime), "yyyy/MM/dd h:mm a")}
                  </TableCell>
                  <TableCell>
                    {getUsername(assignment.studentId, "student")}
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
                    {getUsername(selectedAppointment.studentId, "student")}
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

      <Dialog
        open={isAddIndependentAssignmentDialogOpen}
        onOpenChange={setIsAddIndependentAssignmentDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة مهمة مستقلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                createIndependentAssignmentMutation.mutate(newIndependentAssignmentData)
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