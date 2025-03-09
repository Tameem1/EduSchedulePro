import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Appointment } from "@shared/schema";

// Generate time slots for today
function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  const startHour = 9; // 9 AM
  const endHour = 17; // 5 PM

  for (let hour = startHour; hour <= endHour; hour++) {
    const time = new Date();
    time.setHours(hour, 0, 0, 0);

    // Only include future times for today
    if (time > now) {
      slots.push(time);
    }
  }
  return slots;
}

export default function BookAppointment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTime, setSelectedTime] = React.useState<string>();
  const timeSlots = generateTimeSlots();

  const bookAppointmentMutation = useMutation({
    mutationFn: async (timeString: string) => {
      const time = new Date(timeString);
      const res = await apiRequest("POST", "/api/appointments", {
        startTime: time.toISOString(),
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
            <Select
              value={selectedTime}
              onValueChange={setSelectedTime}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => (
                  <SelectItem 
                    key={time.toISOString()} 
                    value={time.toISOString()}
                  >
                    {format(time, "h:mm a")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full"
            disabled={!selectedTime || bookAppointmentMutation.isPending}
            onClick={() => selectedTime && bookAppointmentMutation.mutate(selectedTime)}
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