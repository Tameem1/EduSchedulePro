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
import { TelegramGuide } from "@/components/telegram/telegram-guide";

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

  // Data fetching
  const { data: appointments, isLoading: loadingAppointments, error: appointmentsError } = useQuery<(Appointment & { student?: User })[]>({
    queryKey: ["/api/teachers", user?.username, "created-appointments"],
    queryFn: async () => {
      if (!user?.username) return [];
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user.username}/created-appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch created appointments");
      }
      return res.json();
    },
    enabled: !!user?.username,
  });

  // Must be teacher
  if (!user || user.role !== UserRole.TEACHER) {
    return (
      <div className="p-4">
        <p>غير مصرح لك بالوصول لهذه الصفحة.</p>
      </div>
    );
  }

  if (loadingAppointments) {
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
      
      {/* Top actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">المواعيد التي أنشأتها</h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">مواعيدي الحالية</Button>
          </Link>
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">إضافة موعد لطالب</Button>
          </Link>
        </div>
      </div>

      {/* Display created appointments */}
      {appointments && appointments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>المواعيد التي أنشأتها للطلاب</CardTitle>
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
                      الطالب: {appointment.student?.username || `طالب #${appointment.studentId}`}
                    </p>
                    {appointment.teacherAssignment && (
                      <p className="text-sm mt-1">
                        <span className="font-semibold">المهمة المطلوبة: </span>
                        {appointment.teacherAssignment}
                      </p>
                    )}
                    <Badge
                      className={`mt-2 text-white ${getStatusColor(appointment.status)}`}
                    >
                      {AppointmentStatusArabic[appointment.status]}
                    </Badge>
                  </div>
                  
                  {/* Show which teacher is assigned if any */}
                  {appointment.teacherId && (
                    <div className="text-right text-sm text-muted-foreground">
                      <span>تم تعيين معلم للموعد</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-center text-muted-foreground">
              لم تقم بإنشاء أي مواعيد للطلاب حتى الآن
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}