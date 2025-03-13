import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle } from "lucide-react";
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

export default function TeacherAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();

  // We fetch all students to:
  //   1) Display their real name for each appointment
  //   2) Let teacher pick which student to create an appointment for
  const {
    data: students,
    isLoading: loadingStudents,
    isError: isErrorStudents,
  } = useQuery<User[]>({
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

  // Query for the teacher’s existing appointments
  const {
    data: appointments,
    isLoading: loadingAppointments,
    isError: isErrorAppointments,
    error: appointmentsError,
  } = useQuery<Appointment[]>({
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

  // Create appointment to a certain student. We'll store local form:
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedStudent, setSelectedStudent] = React.useState("");
  const [startTime, setStartTime] = React.useState("");

  // Mutation that POSTs to /api/appointments with { studentId, startTime }
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: { studentId: number; startTime: string }) => {
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
      setSelectedStudent("");
      setStartTime("");
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
    onSuccess: () => {
      toast({
        title: "تم تحديث حالة الموعد",
        description: "تم تحديث حالة الموعد بنجاح",
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
    createAppointmentMutation.mutate({
      studentId: parseInt(selectedStudent),
      startTime,
    });
  }

  // Helper to get student's real name for an ID
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

  if (loadingStudents || loadingAppointments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isErrorStudents) {
    return (
      <div className="p-4">
        <p>فشل جلب قائمة الطلاب.</p>
      </div>
    );
  }

  if (isErrorAppointments) {
    return (
      <div className="p-4">
        <p>حدث خطأ: {(appointmentsError as Error)?.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Top actions: availability, plus button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">مواعيد المعلم</h1>
        <div className="flex items-center gap-2">
          <Link href="/teacher/availability">
            <Button variant="outline">إدارة التوفر</Button>
          </Link>

          {/* Button+Dialog to add new appointment */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                إضافة موعد لطالب
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة موعد جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>اختر الطالب</Label>
                  <Select
                    value={selectedStudent}
                    onValueChange={(val) => setSelectedStudent(val)}
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
                  {/* Just a date/time input for demonstration */}
                  <input
                    type="datetime-local"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
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
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  {/* Appointment info */}
                  <div>
                    {/* Show local time with our GMT+3 helper */}
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
                  <div className="flex items-center gap-2">
                    {appointment.status === AppointmentStatus.REQUESTED && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            updateAppointmentStatusMutation.mutate({
                              appointmentId: appointment.id,
                              status: AppointmentStatus.ASSIGNED,
                            })
                          }
                          disabled={updateAppointmentStatusMutation.isPending}
                        >
                          قبول
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            updateAppointmentStatusMutation.mutate({
                              appointmentId: appointment.id,
                              status: AppointmentStatus.REJECTED,
                            })
                          }
                          disabled={updateAppointmentStatusMutation.isPending}
                        >
                          رفض
                        </Button>
                      </>
                    )}

                    {appointment.status !== AppointmentStatus.REJECTED && (
                      <Link
                        href={`/teacher/questionnaire-submission/${appointment.id}`}
                      >
                        <Button variant="outline" size="sm">
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