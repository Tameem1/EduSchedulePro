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
import type { User, Availability, Appointment } from "@shared/schema";

export default function ManagerAppointments() {
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);

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

  // Fetch all appointments
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

  // Fetch all availabilities
  const { data: availabilities, isLoading: isLoadingAvailabilities } = useQuery<Availability[]>({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/availabilities");
      if (!res.ok) {
        throw new Error("Failed to fetch availabilities");
      }
      return res.json();
    },
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async ({ appointmentId, teacherId }: { appointmentId: number; teacherId: number }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${appointmentId}`, {
        teacherId,
        status: "matched"
      });
      if (!res.ok) {
        throw new Error("Failed to assign teacher");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تعيين المعلم",
        description: "تم تحديث الموعد بنجاح",
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

  if (isLoadingTeachers || isLoadingAppointments || isLoadingAvailabilities) {
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
        <Link href="/manager/results">
          <Button>عرض النتائج</Button>
        </Link>
      </div>

      {/* Appointments Table */}
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
                  <TableCell>
                    طالب {appointment.studentId}
                  </TableCell>
                  <TableCell>
                    {appointment.teacherId ? `معلم ${appointment.teacherId}` : "غير معين"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        appointment.status === "pending" ? "warning" :
                        appointment.status === "matched" ? "success" :
                        "default"
                      }
                    >
                      {appointment.status === "pending" ? "قيد الانتظار" :
                       appointment.status === "matched" ? "تم التطابق" :
                       "مكتمل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {appointment.status === "pending" && (
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

      {/* Teacher Availability Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>توفر المعلمين</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعلم</TableHead>
                <TableHead>الأوقات المتاحة</TableHead>
                <TableHead>عدد المواعيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers?.map((teacher) => {
                const teacherAvailabilities = availabilities?.filter(
                  (a) => a.teacherId === teacher.id
                );
                const teacherAppointments = appointments?.filter(
                  (a) => a.teacherId === teacher.id
                );

                return (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>
                      {teacherAvailabilities?.length > 0 ? (
                        <div className="space-y-1">
                          {teacherAvailabilities.map((avail) => (
                            <div
                              key={avail.id}
                              className="text-sm flex items-center"
                            >
                              <div className="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
                              <span>
                                {format(new Date(avail.startTime), "h:mm a")} -{" "}
                                {format(new Date(avail.endTime), "h:mm a")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          لا توجد أوقات متاحة
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-medium">{teacherAppointments?.length || 0}</span>
                        {teacherAppointments?.length > 0 && (
                          <Badge variant="outline" className="mr-2">
                            {teacherAppointments.length > 2 ? "مرتفع" : "طبيعي"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Teacher Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعيين معلم للموعد</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p>الوقت: {format(new Date(selectedAppointment.startTime), "h:mm a")}</p>
                  <p>الطالب: طالب {selectedAppointment.studentId}</p>
                </div>
                <div className="space-y-2">
                  {teachers?.map((teacher) => {
                    const isAvailable = availabilities?.some(avail => {
                      const appointmentTime = new Date(selectedAppointment.startTime);
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
                        className={`p-3 border rounded-lg ${
                          isAvailable ? "hover:bg-muted cursor-pointer" : "opacity-50"
                        }`}
                        onClick={() => {
                          if (isAvailable) {
                            assignTeacherMutation.mutate({
                              appointmentId: selectedAppointment.id,
                              teacherId: teacher.id
                            });
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{teacher.username}</span>
                          {isAvailable ? (
                            <Badge variant="success">متوفر</Badge>
                          ) : (
                            <Badge variant="secondary">غير متوفر</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}