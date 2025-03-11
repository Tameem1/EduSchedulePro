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
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { User, Availability, Appointment, AppointmentStatusType } from "@shared/schema";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function ManagerAppointments() {
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const socketRef = React.useRef<WebSocket | null>(null);

  // WebSocket connection setup
  React.useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'appointmentUpdate' || data.type === 'availabilityUpdate') {
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/students"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Fetch all students
  const { data: students, isLoading: isLoadingStudents } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      const data = await res.json();
      return data;
    },
  });

  // Fetch all teachers
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery<User[]>({
    queryKey: ["/api/users/teachers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/teachers");
      if (!res.ok) {
        throw new Error("Failed to fetch teachers");
      }
      return res.json();
    },
  });

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/appointments");
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      teacherId,
    }: {
      appointmentId: number;
      teacherId: number;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        {
          teacherId,
          status: AppointmentStatus.REQUESTED,
        }
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

  const getStudentName = (studentId: number | null) => {
    if (!studentId) return "غير معروف";
    const student = students?.find(s => s.id === studentId);
    return student?.username || "غير معروف";
  };

  const getTeacherName = (teacherId: number | null) => {
    if (!teacherId) return "غير معين";
    const teacher = teachers?.find(t => t.id === teacherId);
    return teacher?.username || "غير معروف";
  };

  const getStatusColor = (status: AppointmentStatusType) => {
    return {
      [AppointmentStatus.PENDING]: "bg-gray-500",
      [AppointmentStatus.REQUESTED]: "bg-blue-500",
      [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
      [AppointmentStatus.RESPONDED]: "bg-green-500",
      [AppointmentStatus.DONE]: "bg-purple-500",
    }[status] || "bg-gray-500";
  };

  if (isAuthLoading || isLoadingTeachers || isLoadingAppointments || isLoadingStudents) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "manager") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Not authorized. You must be a manager to view this page.</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">إدارة المواعيد</h1>
        <Link href="/manager/results">
          <Button>عرض النتائج</Button>
        </Link>
      </div>

      <Card>
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
                  <TableCell>{getStudentName(appointment.studentId)}</TableCell>
                  <TableCell>{getTeacherName(appointment.teacherId)}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(appointment.status as AppointmentStatusType)} text-white`}
                    >
                      {AppointmentStatusArabic[appointment.status as AppointmentStatusType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {appointment.status === AppointmentStatus.PENDING && (
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
                    الوقت: {format(new Date(selectedAppointment.startTime), "HH:mm")}
                  </p>
                  <p>الطالب: {getStudentName(selectedAppointment.studentId)}</p>
                </div>
                <div className="space-y-2">
                  {teachers?.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => {
                        assignTeacherMutation.mutate({
                          appointmentId: selectedAppointment.id,
                          teacherId: teacher.id,
                        });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{teacher.username}</span>
                        <Badge variant="default">متوفر</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}