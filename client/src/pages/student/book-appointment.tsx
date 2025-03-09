import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import type { Appointment, User } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Start and end times for availability
const START_HOUR = 7; // 7 AM
const END_HOUR = 23; // 11 PM

export default function BookAppointment() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTime, setSelectedTime] = React.useState<Date | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<number | null>(null);

  // If still loading auth state, show loading indicator
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not authenticated or not a student, redirect to login
  if (!user || user.role !== 'student') {
    return <Redirect to="/auth" />;
  }

  // Fetch available teachers
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

  const bookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTime || !selectedTeacherId) {
        throw new Error("Please select both a time and a teacher");
      }

      const res = await apiRequest("POST", "/api/appointments", {
        startTime: selectedTime,
        teacherId: selectedTeacherId,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to book appointment");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم حجز الموعد",
        description: "تم تسجيل طلبك بنجاح. سيتم تعيين معلم قريباً.",
      });

      queryClient.invalidateQueries({ 
        queryKey: ["/api/students", user.id, "appointments"] 
      });

      // Reset form
      setSelectedTime(null);
      setSelectedTeacherId(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ في حجز الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch student's appointments
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/students", user.id, "appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/students/${user.id}/appointments`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch appointments");
      }
      return res.json();
    },
  });

  // Generate time slots
  const timeSlots = React.useMemo(() => {
    const slots = [];
    const today = new Date();

    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date(today);
        time.setHours(hour, minute, 0, 0);
        slots.push({
          value: time.toISOString(),
          label: format(time, "h:mm a")
        });
      }
    }
    return slots;
  }, []);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>حجز موعد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Teacher Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">اختر المعلم</label>
              <Select
                value={selectedTeacherId?.toString()}
                onValueChange={(value) => setSelectedTeacherId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر معلماً" />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">اختر الوقت</label>
              <Select
                value={selectedTime?.toISOString()}
                onValueChange={(value) => setSelectedTime(new Date(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر وقتاً" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!selectedTime || !selectedTeacherId || bookAppointmentMutation.isPending}
            onClick={() => bookAppointmentMutation.mutate()}
          >
            {bookAppointmentMutation.isPending ? "جاري الحجز..." : "حجز موعد"}
          </Button>

          {/* Display appointments */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">مواعيدك</h3>
            {isLoadingAppointments ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {format(new Date(appointment.startTime), "h:mm a")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(appointment.startTime), "EEEE, MMMM d")}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-sm ${
                        appointment.status === "pending" 
                          ? "bg-yellow-100 text-yellow-800" 
                          : appointment.status === "matched"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                      }`}>
                        {appointment.status === "pending" 
                          ? "قيد الانتظار"
                          : appointment.status === "matched"
                            ? "تم التطابق"
                            : "مكتمل"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                لا توجد مواعيد مسجلة
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}