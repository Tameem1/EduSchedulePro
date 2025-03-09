
import * as React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, parse, isAfter, isBefore } from "date-fns";
import { Link } from "wouter";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Availability } from "@shared/schema";

// Start and end times for availability
const START_HOUR = 7; // 7 AM
const END_HOUR = 23; // 11 PM

// Generate available time slots in 30-minute increments
const generateTimeOptions = () => {
  const options = [];
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    for (let minute of [0, 30]) {
      // Skip past times for today
      if (hour < currentHours || (hour === currentHours && minute <= currentMinutes)) {
        continue;
      }
      
      const time = new Date();
      time.setHours(hour, minute, 0, 0);
      options.push({
        value: format(time, "HH:mm"),
        label: format(time, "h:mm a")
      });
    }
  }
  
  return options;
};

export default function TeacherAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeRanges, setTimeRanges] = React.useState<Array<{id: string, start: string, end: string}>>([]);
  const timeOptions = React.useMemo(() => generateTimeOptions(), []);
  
  // Add a new time range
  const addTimeRange = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setTimeRanges([...timeRanges, { id: newId, start: "", end: "" }]);
  };
  
  // Remove a time range
  const removeTimeRange = (id: string) => {
    setTimeRanges(timeRanges.filter(range => range.id !== id));
  };
  
  // Update a time range
  const updateTimeRange = (id: string, field: 'start' | 'end', value: string) => {
    setTimeRanges(timeRanges.map(range => 
      range.id === id ? { ...range, [field]: value } : range
    ));
  };
  
  // Check if a time range is valid
  const isValidTimeRange = (start: string, end: string) => {
    if (!start || !end) return false;
    
    const today = new Date();
    const startTime = parse(start, "HH:mm", today);
    const endTime = parse(end, "HH:mm", today);
    
    return isAfter(endTime, startTime);
  };

  const addAvailabilityMutation = useMutation({
    mutationFn: async (range: {start: string, end: string}) => {
      const today = new Date();
      const startTime = parse(range.start, "HH:mm", today);
      const endTime = parse(range.end, "HH:mm", today);

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

  // Submit all valid time ranges
  const submitAvailabilities = async () => {
    const validRanges = timeRanges.filter(range => isValidTimeRange(range.start, range.end));
    
    if (validRanges.length === 0) {
      toast({
        title: "No Valid Time Ranges",
        description: "Please add at least one valid time range.",
        variant: "destructive",
      });
      return;
    }
    
    // Submit each range sequentially
    for (const range of validRanges) {
      await addAvailabilityMutation.mutateAsync(range);
    }
    
    // Clear the form after successful submission
    setTimeRanges([]);
  };

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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add your available time slots for today. You can add multiple time ranges.
            </p>
            
            {timeRanges.length === 0 && (
              <div className="text-center py-4 border border-dashed rounded-md">
                <p className="text-muted-foreground">No time ranges added yet</p>
              </div>
            )}
            
            {timeRanges.map((range) => (
              <div key={range.id} className="flex items-center space-x-2 p-3 border rounded-md bg-muted/30">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Start Time
                    </label>
                    <Select
                      value={range.start}
                      onValueChange={(value) => updateTimeRange(range.id, 'start', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      End Time
                    </label>
                    <Select
                      value={range.end}
                      onValueChange={(value) => updateTimeRange(range.id, 'end', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select end time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0" 
                  onClick={() => removeTimeRange(range.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button
              variant="outline"
              className="w-full"
              onClick={addTimeRange}
            >
              Add Time Range
            </Button>
          </div>

          <Button 
            className="w-full"
            disabled={
              timeRanges.length === 0 || 
              !timeRanges.some(range => isValidTimeRange(range.start, range.end)) ||
              addAvailabilityMutation.isPending
            }
            onClick={submitAvailabilities}
          >
            {addAvailabilityMutation.isPending 
              ? "Saving Availability..." 
              : "Save All Availability"}
          </Button>

          {availabilities && availabilities.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Available Slots Today</h3>
              <div className="space-y-2">
                {availabilities.map((availability) => (
                  <div key={availability.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {format(new Date(availability.startTime), "h:mm a")} - {format(new Date(availability.endTime), "h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(availability.startTime), "EEEE, MMMM d, yyyy")}
                        </p>
                      </div>
                      <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Available
                      </div>
                    </div>
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
