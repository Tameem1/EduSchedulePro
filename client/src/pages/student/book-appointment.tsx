import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import type { Appointment } from "@shared/schema";
import { formatGMT3Time, getGMT3ISOString } from "@/lib/date-utils";

// Start and end times for availability
const START_HOUR = 7; // 7 AM
const END_HOUR = 23; // 11 PM
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 2 slots per hour (30 min each)

export default function BookAppointment() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [sliderValue, setSliderValue] = React.useState<number[]>([0]);
  const [selectedTime, setSelectedTime] = React.useState<Date | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);

  // WebSocket connection setup
  React.useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'appointmentUpdate') {
        // Refresh appointments list when there's an update
        queryClient.invalidateQueries({ 
          queryKey: ["/api/students", user?.id, "appointments"] 
        });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user?.id]);

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

  // Convert slider value to time and update the selected time
  React.useEffect(() => {
    if (sliderValue[0] !== undefined) {
      const time = new Date();
      const selectedSlot = sliderValue[0];

      // Calculate hours and minutes from the slot
      const totalHours = START_HOUR + selectedSlot / 2;
      const hours = Math.floor(totalHours);
      const minutes = (totalHours - hours) * 60;

      // Set the time components - creating a direct time without timezone issues
      time.setHours(hours);
      time.setMinutes(minutes);
      time.setSeconds(0);
      time.setMilliseconds(0);

      setSelectedTime(time);
    }
  }, [sliderValue]);

  const bookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTime) throw new Error("Please select a time");

      // Create an ISO string but preserve the exact hours/minutes selected
      const year = selectedTime.getFullYear();
      const month = selectedTime.getMonth();
      const day = selectedTime.getDate();
      const hours = selectedTime.getHours();
      const minutes = selectedTime.getMinutes();

      // Create a new date in UTC to prevent timezone offset issues
      const utcTime = new Date(Date.UTC(year, month, day, hours, minutes, 0));

      const appointment = {
        startTime: utcTime.toISOString(),
      };

      const res = await apiRequest("POST", "/api/appointments", appointment);

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

      // Reset slider
      setSliderValue([0]);
      setSelectedTime(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ في حجز الموعد",
        description: error.message === "لديك حجز موجود بالفعل في هذا الوقت" 
          ? "لديك حجز موجود بالفعل في هذا الوقت" 
          : error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch student's appointments and teacher data
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ["/api/students", user?.id, "appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/students/${user?.id}/appointments`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch appointments");
      }
      return res.json();
    },
  });

  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["/api/users/teachers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/teachers");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch teachers");
      }
      return res.json();
    },
  });


  if (isLoadingAppointments || isLoadingTeachers) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>حجز موعد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              اختر الوقت المناسب لك
            </p>

            <div className="py-6">
              <Slider
                min={0}
                max={TOTAL_SLOTS - 1}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
              />

              <div className="mt-6 text-center bg-muted/50 p-4 rounded-md">
                <p className="text-xl font-semibold">
                  {selectedTime ? formatGMT3Time(selectedTime) : "اختر وقتاً"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  حرك المؤشر لاختيار الوقت المناسب لك
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!selectedTime || bookAppointmentMutation.isPending}
            onClick={() => bookAppointmentMutation.mutate()}
          >
            {bookAppointmentMutation.isPending ? "جاري الحجز..." : "حجز موعد"}
          </Button>

          {/* Display appointments */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">مواعيدك</h3>
            {appointments && appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((appointment) => (
                  <Card className="mb-4" key={appointment.id}>
                    <CardHeader>
                      <CardTitle>
                        {appointment.status === "pending"
                          ? "قيد الانتظار"
                          : appointment.status === "matched"
                          ? "تم التطابق"
                          : "مكتمل"}
                      </CardTitle>
                      <CardDescription>
                        {formatGMT3Time(new Date(appointment.startTime))}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-2 items-center gap-4">
                          <div className="font-medium">المعلم:</div>
                          <div>
                            {appointment.teacher
                              ? appointment.teacher.username
                              : "لم يتم التعيين بعد"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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