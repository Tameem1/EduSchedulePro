
import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, setHours, setMinutes } from "date-fns";
import type { Appointment } from "@shared/schema";

// Calculate the number of 30-minute slots between 7 AM and 11:30 PM
const START_HOUR = 7; // 7 AM
const END_HOUR = 23.5; // 11:30 PM
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 2 slots per hour (30 min each)

export default function BookAppointment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sliderValue, setSliderValue] = React.useState<number[]>([0]);
  const [selectedTime, setSelectedTime] = React.useState<Date | null>(null);
  
  // Convert slider value to time and update the selected time
  React.useEffect(() => {
    if (sliderValue[0] !== undefined) {
      const now = new Date();
      const selectedSlot = sliderValue[0];
      
      // Calculate hours and minutes from the slot
      const totalHours = START_HOUR + (selectedSlot / 2);
      const hours = Math.floor(totalHours);
      const minutes = (totalHours - hours) * 60;
      
      const time = new Date(now);
      time.setHours(hours, minutes, 0, 0);
      setSelectedTime(time);
    }
  }, [sliderValue]);
  
  // Format the time display for the slider
  const formatTimeLabel = (value: number) => {
    const totalHours = START_HOUR + (value / 2);
    const hours = Math.floor(totalHours);
    const minutes = (totalHours - hours) * 60;
    
    const time = new Date();
    time.setHours(hours, minutes, 0, 0);
    
    return format(time, "h:mm a");
  };

  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  
  const bookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTime) return null;
      const res = await apiRequest("POST", "/api/appointments", {
        startTime: selectedTime.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      // Show both toast and success message
      toast({
        title: "تم طلب الموعد",
        description: "شكراً على حجز موعد. سيتصل بك أحد المعلمين قريباً!",
        duration: 5000, // Show for 5 seconds
      });
      
      // Set success message that will display in the UI
      setSuccessMessage("شكراً على حجز موعد. سيتصل بك أحد المعلمين قريباً!");
      
      queryClient.invalidateQueries({ queryKey: ["/api/students", user!.id, "appointments"] });
    },
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/students", user!.id, "appointments"],
  });

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>حجز موعد لليوم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">حدد فترة زمنية متاحة</p>
            <div className="py-6 px-1">
              <Slider
                min={0}
                max={TOTAL_SLOTS - 1}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
              />
              
              <div className="mt-6 flex justify-between">
                <span className="text-sm">7:00 صباحاً</span>
                <span className="text-sm">11:30 مساءً</span>
              </div>
              
              <div className="mt-6 text-center bg-muted p-4 rounded-md">
                <p className="text-xl font-semibold">
                  {selectedTime ? format(selectedTime, "h:mm a") : "اختر وقتاً"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  حرك المؤشر لاختيار الوقت المفضل لديك
                </p>
              </div>
            </div>
          </div>

          <Button 
            className="w-full"
            disabled={!selectedTime || bookAppointmentMutation.isPending}
            onClick={() => bookAppointmentMutation.mutate()}
          >
            طلب موعد
          </Button>
          
          {successMessage && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {successMessage}
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">مواعيدك</h3>
            <div className="space-y-2">
              {(appointments && appointments.length > 0) ? (
                appointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 border rounded-md">
                    <p>الوقت: {format(new Date(appointment.startTime), "h:mm a")}</p>
                    <p>الحالة: {
                      appointment.status === "pending" ? "قيد الانتظار" :
                      appointment.status === "matched" ? "تم التطابق" :
                      appointment.status === "completed" ? "مكتمل" :
                      appointment.status
                    }</p>
                  </div>
                ))
              ) : (
                // Example appointments if none are available
                [
                  { id: 101, startTime: new Date().setHours(14, 30), status: "pending" },
                  { id: 102, startTime: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(10, 0), status: "matched" }
                ].map((appointment) => (
                  <div key={appointment.id} className="p-4 border rounded-md bg-gray-50">
                    <p>الوقت: {format(new Date(appointment.startTime), "h:mm a")}</p>
                    <p>الحالة: {
                      appointment.status === "pending" ? "قيد الانتظار" :
                      appointment.status === "matched" ? "تم التطابق" :
                      appointment.status === "completed" ? "مكتمل" :
                      appointment.status
                    }</p>
                    <p className="text-xs text-gray-500 mt-1">(مثال)</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
