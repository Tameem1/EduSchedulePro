import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import type { Appointment } from "@shared/schema";
import { format } from "date-fns";

export default function StudentAppointments() {
  const { user } = useAuth();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/students", user?.id, "appointments"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/students/${user?.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
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
            <CardTitle>مواعيدي</CardTitle>
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
          <CardTitle>مواعيدي</CardTitle>
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
                  <Badge
                    className="mt-2"
                    variant={
                      appointment.status === AppointmentStatus.PENDING
                        ? "outline"
                        : "default"
                    }
                  >
                    {AppointmentStatusArabic[appointment.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
