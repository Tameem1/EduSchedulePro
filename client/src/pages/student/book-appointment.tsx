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

      // Set the time components
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

      const appointment = {
        startTime: selectedTime.toISOString(),
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
                          {formatGMT3Time(new Date(appointment.startTime))}
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