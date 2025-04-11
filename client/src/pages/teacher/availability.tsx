import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parse, isAfter } from "date-fns";
import { Link, Redirect } from "wouter";
import { X, Plus, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Availability } from "@shared/schema";
import { TelegramGuide } from "@/components/telegram/telegram-guide";

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
        label: format(time, "h:mm a"),
      });
    }
  }

  return options;
}

export default function TeacherAvailability() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [timeRanges, setTimeRanges] = React.useState<
    Array<{ id: string; start: string; end: string }>
  >([]);
  const timeOptions = React.useMemo(() => generateTimeOptions(), []);

  // If still loading auth state, show loading indicator
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not authenticated or not a teacher, redirect to login
  if (!user || user.role !== "teacher") {
    return <Redirect to="/auth" />;
  }

  // Add a new time range
  const addTimeRange = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setTimeRanges([...timeRanges, { id: newId, start: "", end: "" }]);
  };

  // Remove a time range
  const removeTimeRange = (id: string) => {
    setTimeRanges(timeRanges.filter((range) => range.id !== id));
  };

  // Update a time range
  const updateTimeRange = (
    id: string,
    field: "start" | "end",
    value: string,
  ) => {
    setTimeRanges(
      timeRanges.map((range) =>
        range.id === id ? { ...range, [field]: value } : range,
      ),
    );
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
    mutationFn: async (range: { start: string; end: string }) => {
      const today = new Date();
      const [startHours, startMinutes] = range.start.split(":").map(Number);
      const [endHours, endMinutes] = range.end.split(":").map(Number);

      // Format dates in ISO format but preserve the local time
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      const startTimeStr = `${year}-${month}-${day}T${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}:00`;
      const endTimeStr = `${year}-${month}-${day}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

      const res = await apiRequest("POST", "/api/availabilities", {
        startTime: startTimeStr,
        endTime: endTimeStr,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add availability");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إضافة التوفر",
        description: "تم تحديث توفرك.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user!.id, "availabilities"],
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ في إضافة التوفر",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (availabilityId: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/availabilities/${availabilityId}`,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete availability");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم حذف التوفر",
        description: "تم حذف فترة توفرك بنجاح.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user!.id, "availabilities"],
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ في حذف التوفر",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: availabilities, isLoading: isLoadingAvailabilities } = useQuery<
    Availability[]
  >({
    queryKey: ["/api/teachers", user.id, "availabilities"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user.id}/availabilities`,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch availabilities");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Submit all valid time ranges
  const submitAvailabilities = async () => {
    const validRanges = timeRanges.filter((range) =>
      isValidTimeRange(range.start, range.end),
    );

    if (validRanges.length === 0) {
      toast({
        title: "لا توجد فترات زمنية صالحة",
        description: "يرجى إضافة فترة زمنية صالحة واحدة على الأقل.",
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
        <h1 className="text-2xl font-bold">إدارة توفر اليوم</h1>
        <Link href="/teacher/appointments">
          <Button>الذهاب إلى الاستبيان</Button>
        </Link>
      </div>

      {/* Show Telegram Guide if teacher doesn't have telegramUsername */}
      {user && user.role === 'teacher' && !user.telegramUsername && (
        <TelegramGuide />
      )}

      <Card>
        <CardHeader>
          <CardTitle>إضافة توفر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              أضف فتراتك الزمنية المتاحة لهذا اليوم. يمكنك إضافة العديد من
              الفترات الزمنية.
            </p>

            {timeRanges.length === 0 && (
              <div
                onClick={addTimeRange}
                className="text-center py-6 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Plus className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">انقر لإضافة نطاق زمني</p>
              </div>
            )}

            {timeRanges.map((range) => (
              <div
                key={range.id}
                className="flex items-center space-x-2 p-4 border rounded-md bg-muted/30"
              >
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      وقت البدء
                    </label>
                    <Select
                      value={range.start}
                      onValueChange={(value) =>
                        updateTimeRange(range.id, "start", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="حدد وقت البدء" />
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
                      وقت الانتهاء
                    </label>
                    <Select
                      value={range.end}
                      onValueChange={(value) =>
                        updateTimeRange(range.id, "end", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="حدد وقت الانتهاء" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => {
                          const isDisabled = range.start
                            ? !isAfter(
                                parse(option.value, "HH:mm", new Date()),
                                parse(range.start, "HH:mm", new Date()),
                              )
                            : false;
                          return (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              disabled={isDisabled}
                            >
                              {option.label}
                            </SelectItem>
                          );
                        })}
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
                إضافة نطاق زمني آخر
              </Button>
            )}
          </div>

          <Button
            className="w-full"
            disabled={
              timeRanges.length === 0 ||
              !timeRanges.some((range) =>
                isValidTimeRange(range.start, range.end),
              ) ||
              addAvailabilityMutation.isPending
            }
            onClick={submitAvailabilities}
          >
            {addAvailabilityMutation.isPending
              ? "حفظ التوفر..."
              : "حفظ كل التوفر"}
          </Button>

          {isLoadingAvailabilities ? (
            <div className="mt-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : availabilities && availabilities.length > 0 ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">
                فتراتك المتاحة اليوم
              </h3>
              <div className="space-y-2">
                {availabilities.map((availability) => (
                  <div
                    key={availability.id}
                    className="p-4 border rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {format(new Date(availability.startTime), "h:mm a")} -{" "}
                          {format(new Date(availability.endTime), "h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(availability.startTime),
                            "EEEE, MMMM d, yyyy",
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded flex items-center ml-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full ml-1"></span>
                          متوفر
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={() =>
                            deleteAvailabilityMutation.mutate(availability.id.toString())
                          }
                          disabled={deleteAvailabilityMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center text-muted-foreground">
              لا توجد فترات متاحة. أضف فترات جديدة باستخدام النموذج أعلاه.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}