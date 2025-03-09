import * as React from 'react';
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

  const bookAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTime) return null;
      const res = await apiRequest("POST", "/api/appointments", {
        startTime: selectedTime.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment Requested",
        description: "A teacher will contact you soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students", user!.id, "appointments"] });
    },
  });

  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/students", user!.id, "appointments"],
  });

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Book an Appointment for Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select an available time slot</p>
            <div className="py-6 px-1">
              <Slider
                min={0}
                max={TOTAL_SLOTS - 1}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
              />
              
              <div className="mt-6 flex justify-between">
                <span className="text-sm">7:00 AM</span>
                <span className="text-sm">11:30 PM</span>
              </div>
              
              <div className="mt-6 text-center bg-muted p-4 rounded-md">
                <p className="text-xl font-semibold">
                  {selectedTime ? format(selectedTime, "h:mm a") : "Select a time"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Move the slider to select your preferred time
                </p>
              </div>
            </div>
          </div>

          <Button 
            className="w-full"
            disabled={!selectedTime || bookAppointmentMutation.isPending}
            onClick={() => bookAppointmentMutation.mutate()}
          >
            Request Appointment
          </Button>

          {appointments && appointments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Appointments</h3>
              <div className="space-y-2">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 border rounded-md">
                    <p>Time: {format(new Date(appointment.startTime), "h:mm a")}</p>
                    <p>Status: {appointment.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}