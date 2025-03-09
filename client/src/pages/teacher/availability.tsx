import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, addHours } from "date-fns";
import { Link } from "wouter";
import type { Availability } from "@shared/schema";

// Generate time slots for today
function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  const startHour = 7; // 7 AM
  const endHour = 24; // 12 AM (midnight)

  for (let hour = startHour; hour < endHour; hour++) {
    const time = new Date();
    time.setHours(hour, 0, 0, 0);

    // Only include future times for today
    if (time > now) {
      slots.push(time);
    }
  }
  return slots;
}

export default function TeacherAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTime, setSelectedTime] = React.useState<string>();
  const timeSlots = generateTimeSlots();

  const addAvailabilityMutation = useMutation({
    mutationFn: async (timeString: string) => {
      const startTime = new Date(timeString);
      const endTime = addHours(startTime, 1);

      const res = await apiRequest("POST", "/api/availabilities", {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Availability Added",
        description: "Your availability has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", user!.id, "availabilities"] });
    },
  });

  const { data: availabilities } = useQuery<Availability[]>({
    queryKey: ["/api/teachers", user!.id, "availabilities"],
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Manage Today's Availability</h1>
        <Link href="/teacher/questionnaire">
          <Button>Go to Questionnaire</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Availability</CardTitle>
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
            disabled={!selectedTime || addAvailabilityMutation.isPending}
            onClick={() => selectedTime && addAvailabilityMutation.mutate(selectedTime)}
          >
            Add Availability
          </Button>

          {availabilities && availabilities.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Available Slots Today</h3>
              <div className="space-y-2">
                {availabilities.map((availability) => (
                  <div key={availability.id} className="p-4 border rounded-md">
                    <p>Start: {format(new Date(availability.startTime), "h:mm a")}</p>
                    <p>End: {format(new Date(availability.endTime), "h:mm a")}</p>
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