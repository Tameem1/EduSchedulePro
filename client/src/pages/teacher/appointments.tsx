import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import type { Appointment, User } from "@shared/schema";

export default function TeacherAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "appointmentUpdate") {
        queryClient.invalidateQueries({
          queryKey: ["/api/teachers", user?.id, "appointments"],
        });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user?.id]);

  // Fetch teacher's appointments
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user?.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch students data
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Helper function to get student name
  const getStudentName = (studentId: number) => {
    const student = students?.find((s) => s.id === studentId);
    return student?.username || `طالب ${studentId}`;
  };

  // Accept appointment mutation
  const acceptAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}/response`,
        { responded: true },
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to accept appointment");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم قبول الموعد",
        description: "سيتم إخطار الطالب بقبول الموعد",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "appointments"],
      });
    },
    onError: (error) => {
      console.error("Error accepting appointment:", error);
      toast({
        title: "خطأ في قبول الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!appointments?.length) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>المواعيد</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              لا توجد مواعيد لهذا اليوم
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>المواعيد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(appointment.startTime), "h:mm a")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getStudentName(appointment.studentId)}
                  </p>
                  <Badge
                    className="mt-2"
                    variant={
                      appointment.status === AppointmentStatus.ASSIGNED
                        ? "outline"
                        : "default"
                    }
                  >
                    {AppointmentStatusArabic[appointment.status]}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {appointment.status === AppointmentStatus.ASSIGNED && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        acceptAppointmentMutation.mutate(appointment.id)
                      }
                      disabled={acceptAppointmentMutation.isPending}
                    >
                      {acceptAppointmentMutation.isPending
                        ? "جاري القبول..."
                        : "قبول الموعد"}
                    </Button>
                  )}
                  {appointment.status === AppointmentStatus.RESPONDED && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.href = `/teacher/questionnaire/${appointment.id}`;
                      }}
                    >
                      إكمال الاستبيان
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
