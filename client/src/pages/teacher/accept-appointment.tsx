import * as React from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AppointmentStatus } from "@shared/schema";
import type { Appointment, User } from "@shared/schema";

export default function AcceptAppointment() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [isAccepted, setIsAccepted] = React.useState(false);

  // Fetch appointment details
  const { data: appointment, isLoading: isLoadingAppointment } = useQuery<Appointment>({
    queryKey: ["/api/appointments", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch appointment");
      }
      return res.json();
    },
    enabled: !!id && !!user,
  });

  // Fetch student data
  const { data: student } = useQuery<User>({
    queryKey: ["/api/users", appointment?.studentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${appointment?.studentId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch student details");
      }
      return res.json();
    },
    enabled: !!appointment?.studentId,
  });

  const acceptAppointmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${id}/response`,
        { responded: false } // Set to false to keep status as ASSIGNED
      );
      if (!res.ok) {
        throw new Error("Failed to accept appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsAccepted(true);
      toast({
        title: "تم قبول الموعد",
        description: "سيتم إخطار الطالب بقبول الموعد",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      // Redirect to the appointments page after 2 seconds
      setTimeout(() => {
        setLocation("/teacher/appointments");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "خطأ في قبول الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-accept when teacher is logged in and appointment is found
  React.useEffect(() => {
    if (user && appointment && !isAccepted && appointment.status === AppointmentStatus.REQUESTED) {
      acceptAppointmentMutation.mutate();
    }
  }, [user, appointment, isAccepted]);

  if (isAuthLoading || isLoadingAppointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <p>يجب تسجيل الدخول كمعلم للوصول إلى هذه الصفحة.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <p>لم يتم العثور على الموعد</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>تأكيد قبول الموعد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="font-medium">تفاصيل الموعد:</p>
              <p>الوقت: {format(new Date(appointment.startTime), "HH:mm")}</p>
              <p>الطالب: {student?.username || `طالب ${appointment.studentId}`}</p>
              <p>الحالة: {isAccepted ? "تم التعيين" : "في انتظار القبول"}</p>
            </div>
            {!isAccepted && appointment.status === AppointmentStatus.REQUESTED && (
              <Button
                className="w-full"
                onClick={() => acceptAppointmentMutation.mutate()}
                disabled={acceptAppointmentMutation.isPending}
              >
                {acceptAppointmentMutation.isPending ? "جاري قبول الموعد..." : "قبول الموعد"}
              </Button>
            )}
            {isAccepted && (
              <div className="text-center text-green-600">
                تم قبول الموعد بنجاح! سيتم تحويلك إلى صفحة المواعيد...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}