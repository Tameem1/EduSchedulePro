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
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { User, Availability } from "@shared/schema";

export default function ManagerAppointments() {
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
  });

  // Fetch all availabilities
  const { data: availabilities, isLoading: isLoadingAvailabilities } = useQuery<Availability[]>({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/availabilities");
      if (!res.ok) {
        throw new Error("Failed to fetch availabilities");
      }
      return res.json();
    },
    enabled: !!teachers?.length,
  });

  if (isLoadingTeachers || isLoadingAvailabilities) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <div dir="rtl" className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">إدارة المواعيد</h1>
        <Link href="/manager/results">
          <Button>عرض النتائج</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>توفر المعلمين</CardTitle>
        </CardHeader>
        <CardContent>
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead>المعلم</TableHead>
                <TableHead>الأوقات المتاحة</TableHead>
                <TableHead>المواعيد اليوم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers?.map((teacher) => {
                const teacherAvailabilities = availabilities?.filter(
                  (a) => a.teacherId === teacher.id
                );

                return (
                  <TableRow key={teacher.id} dir="rtl">
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>
                      {teacherAvailabilities?.length > 0 ? (
                        <div className="space-y-1">
                          {teacherAvailabilities.map((avail) => (
                            <div
                              key={avail.id}
                              className="text-sm flex items-center"
                            >
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span>
                                {format(new Date(avail.startTime), "h:mm a")} -{" "}
                                {format(new Date(avail.endTime), "h:mm a")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          لا توجد تواريخ متاحة
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-medium">{teacherAvailabilities?.length || 0}</span>
                        {teacherAvailabilities?.length > 0 && (
                          <Badge variant="outline" className="ml-2">
                            {teacherAvailabilities.length > 2 ? "مرتفع" : "طبيعي"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}