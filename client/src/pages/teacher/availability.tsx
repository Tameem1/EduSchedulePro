import * as React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parse, isAfter } from "date-fns";
import { Link } from "wouter";
import { X, Plus } from "lucide-react";
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

// Generate available time slots in 15-minute increments
function generateTimeOptions() {
  const options = [];
  const currentDate = new Date();

  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      // Skip the last slot at 11:00 PM
      if (hour === END_HOUR && minute > 0) continue;

      const time = new Date(currentDate);
      time.setHours(hour, minute, 0, 0);
      options.push({
        value: format(time, "HH:mm"),
        label: format(time, "h:mm a")
      });
    }
  }

  return options;
}

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

  const displayAvailabilities = React.useMemo(() => {
    const today = new Date();
    // Sample availability slots as examples
    const exampleAvailabilities = [
      { 
        id: 101, 
        teacherId: user?.id || "example", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0).toISOString() 
      },
      { 
        id: 102, 
        teacherId: user?.id || "example", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0).toISOString(), 
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0, 0).toISOString() 
      },
      { 
        id: 103, 
        teacherId: user?.id || "example", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30, 0).toISOString(), 
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0).toISOString() 
      },
    ];
    
    // Only show examples if there are no real availabilities
    return (availabilities && availabilities.length > 0) ? availabilities : exampleAvailabilities;
  }, [availabilities, user?.id]);


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
              <div 
                onClick={addTimeRange}
                className="text-center py-6 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Plus className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Click to add a time range</p>
              </div>
            )}

            {timeRanges.map((range) => (
              <div key={range.id} className="flex items-center space-x-2 p-4 border rounded-md bg-muted/30">
                <div className="grid grid-cols-2 gap-4 flex-1">
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
                        {timeOptions.map((option) => (
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
                        {timeOptions.map((option) => (
                          <SelectItem 
                            key={option.value} 
                            value={option.value}
                            disabled={
                              range.start && 
                              !isAfter(
                                parse(option.value, "HH:mm", new Date()),
                                parse(range.start, "HH:mm", new Date())
                              )
                            }
                          >
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
                  onClick={() => removeTimeRange(range.id)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {timeRanges.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={addTimeRange}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Time Range
              </Button>
            )}
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

          {displayAvailabilities.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Available Slots Today</h3>
              <div className="space-y-2">
                {displayAvailabilities.map((availability) => (
                  <div key={availability.id} className="p-4 border rounded-md hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {format(new Date(availability.startTime), "h:mm a")} - {format(new Date(availability.endTime), "h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(availability.startTime), "EEEE, MMMM d, yyyy")}
                        </p>
                      </div>
                      <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        Available
                      </div>
                    </div>
                    {availability.id >= 100 && (
                      <div className="flex mt-2 items-center">
                        <p className="text-xs text-gray-500">(Example availability slot)</p>
                        {availability.id === 101 && (
                          <span className="text-xs text-blue-500 ml-2">Morning session</span>
                        )}
                        {availability.id === 102 && (
                          <span className="text-xs text-blue-500 ml-2">Afternoon session</span>
                        )}
                        {availability.id === 103 && (
                          <span className="text-xs text-blue-500 ml-2">Evening session</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {displayAvailabilities.every(a => a.id >= 100) && (
                <p className="text-sm text-muted-foreground mt-4">
                  These are example availability slots. Add your own slots using the form above.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}