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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Availability, User } from "@shared/schema";

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
  
  // Fetch all teachers
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery<User[]>({
    queryKey: ["/api/users/teachers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/teachers");
      if (!res.ok) {
        throw new Error("Failed to fetch teachers");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });
  
  // Fetch all availabilities (today only)
  const { data: allAvailabilities, isLoading: isLoadingAllAvailabilities } = useQuery<
    Availability[]
  >({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/availabilities");
      if (!res.ok) {
        throw new Error("Failed to fetch all availabilities");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });
  
  // Prepare data for other teachers' availabilities table
  const otherTeachersAvailabilityData = React.useMemo(() => {
    if (!teachers || !allAvailabilities) return [];
    
    // Filter out the current teacher
    const otherTeachers = teachers.filter(teacher => teacher.id !== user.id);
    
    return otherTeachers.map(teacher => {
      // Find all availabilities for this teacher
      const teacherAvailabilities = allAvailabilities.filter(
        avail => avail.teacherId === teacher.id
      );
      
      // Format availability time ranges
      const availabilityRanges = teacherAvailabilities.map(avail => {
        const start = new Date(avail.startTime);
        const end = new Date(avail.endTime);
        return {
          id: avail.id,
          timeRange: `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`,
          startDate: start,
          endDate: end
        };
      });
      
      // Sort by start time
      availabilityRanges.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      return {
        teacher,
        availabilityRanges,
        hasAvailability: teacherAvailabilities.length > 0
      };
    });
  }, [teachers, allAvailabilities, user?.id]);

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
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">إدارة توفر اليوم</h1>
        <Link href="/teacher/appointments">
          <Button className="w-full sm:w-auto">عرض المواعيد</Button>
        </Link>
      </div>



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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
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
                      <SelectContent className="max-h-60 overflow-y-auto">
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
                      <SelectContent className="max-h-60 overflow-y-auto">
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
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded flex items-center">
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

      {/* Other Teachers' Availabilities Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>توفر المعلمين الآخرين اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTeachers || isLoadingAllAvailabilities ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : otherTeachersAvailabilityData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد معلمون آخرون في النظام.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم المعلم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">أوقات التوفر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherTeachersAvailabilityData.length > 0 ? (
                    // Sort teachers with availability to appear first
                    [...otherTeachersAvailabilityData]
                      .sort((a, b) => {
                        // Sort teachers with availability first
                        if (a.hasAvailability === b.hasAvailability) {
                          return 0;
                        }
                        return a.hasAvailability ? -1 : 1;
                      })
                      .map((item) => (
                        <TableRow key={item.teacher.id}>
                          <TableCell className="font-medium">
                            {item.teacher.username}
                          </TableCell>
                          <TableCell>
                            {item.hasAvailability ? (
                              <Badge className="bg-green-100 text-green-800">
                                متوفر
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                غير متوفر
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.availabilityRanges.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {item.availabilityRanges.map((range) => (
                                  <div key={range.id} className="text-sm">
                                    {range.timeRange}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                لا توجد فترات متاحة
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        لا يوجد معلمون آخرون حاليًا
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}