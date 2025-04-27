import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type {
  User,
  Availability,
  Appointment,
} from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function ManagerTeachersAvailability() {
  const { user } = useAuth();

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
    enabled: !!user,
  });

  // Fetch all availabilities (today only)
  const { data: availabilities, isLoading: isLoadingAvailabilities } = useQuery<
    Availability[]
  >({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/availabilities");
      if (!res.ok) {
        throw new Error("Failed to fetch availabilities");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch all appointments (today only)
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<
    Appointment[]
  >({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/appointments");
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Prepare data for the table
  const teacherAvailabilityData = React.useMemo(() => {
    if (!teachers || !availabilities || !appointments) return [];

    return teachers.map(teacher => {
      // Find all availabilities for this teacher
      const teacherAvailabilities = availabilities.filter(
        avail => avail.teacherId === teacher.id
      );
      
      // Format availability time ranges
      const availabilityRanges = teacherAvailabilities.map(avail => {
        const start = new Date(avail.startTime);
        const end = new Date(avail.endTime);
        return {
          id: avail.id,
          start: format(start, "h:mm a"),
          end: format(end, "h:mm a"),
          // Format as a single string for display (from - to)
          timeRange: `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`,
          startDate: start,
          endDate: end
        };
      });
      
      // Sort by start time
      availabilityRanges.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Count appointments for this teacher
      const appointmentCount = appointments.filter(
        appt => appt.teacherId === teacher.id
      ).length;

      return {
        teacher,
        availabilityRanges,
        appointmentCount,
        hasAvailability: teacherAvailabilities.length > 0
      };
    });
  }, [teachers, availabilities, appointments]);

  // Loading state
  if (
    !user ||
    user.role !== "manager" ||
    isLoadingTeachers ||
    isLoadingAvailabilities ||
    isLoadingAppointments
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">توفر المعلمين</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link href="/manager/appointments" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">العودة إلى المواعيد</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle>توفر المعلمين وعدد المواعيد اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم المعلم</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">أوقات التوفر</TableHead>
                  <TableHead className="text-center">عدد المواعيد اليوم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teacherAvailabilityData.length > 0 ? (
                  // Sort teachers with availability to appear first
                  [...teacherAvailabilityData]
                    .sort((a, b) => {
                      // Sort teachers with availability first (true values first)
                      if (a.hasAvailability === b.hasAvailability) {
                        return 0; // Keep original order if both have same availability status
                      }
                      return a.hasAvailability ? -1 : 1; // Available teachers (-1) come before unavailable ones (1)
                    })
                    .map((item) => (
                    <TableRow key={item.teacher.id}>
                      <TableCell className="font-medium">{item.teacher.username}</TableCell>
                      <TableCell>
                        {item.hasAvailability ? (
                          <Badge className="bg-green-500 hover:bg-green-600">متوفر</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-muted-foreground">
                            غير متوفر
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.availabilityRanges.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {item.availabilityRanges.map((range) => (
                              <span key={range.id} className="text-sm">
                                <span dir="ltr" className="inline-block">{range.timeRange}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">لا يوجد توفر</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.appointmentCount > 0 ? (
                          <Badge variant="secondary" className="px-2 py-1">
                            {item.appointmentCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center">
                      لا يوجد معلمين لعرضهم
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}