import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import type { Appointment, User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function TeacherAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = React.useRef<WebSocket | null>(null);
  const [selectedStudent, setSelectedStudent] = React.useState<string>("");
  const [selectedTime, setSelectedTime] = React.useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "appointmentUpdate") {
        queryClient.invalidateQueries({
          queryKey: ["/api/teachers", user?.id, "appointments"],
        });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user?.id]);

  // Fetch teacher's appointments
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user?.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch students data
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Helper function to get student name
  const getStudentName = (studentId: number) => {
    const student = students?.find((s) => s.id === studentId);
    return student?.username || `طالب ${studentId}`;
  };

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: { studentId: number; startTime: string }) => {
      const res = await apiRequest("POST", "/api/appointments", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الموعد",
        description: "تم إنشاء الموعد بنجاح وإرساله للمدير للموافقة",
      });
      setIsDialogOpen(false);
      setSelectedStudent("");
      setSelectedTime("");
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "appointments"],
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ في إنشاء الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAppointment = async () => {
    if (!selectedStudent || !selectedTime) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار الطالب والوقت",
        variant: "destructive",
      });
      return;
    }

    createAppointmentMutation.mutate({
      studentId: parseInt(selectedStudent),
      startTime: selectedTime,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">المواعيد</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              إضافة موعد لطالب
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة موعد جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="student">اختر الطالب</Label>
                <Select
                  value={selectedStudent}
                  onValueChange={setSelectedStudent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطالب" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((student) => (
                      <SelectItem
                        key={student.id}
                        value={student.id.toString()}
                      >
                        {student.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="time">اختر الوقت</Label>
                <input
                  type="datetime-local"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateAppointment}
                disabled={createAppointmentMutation.isPending}
              >
                {createAppointmentMutation.isPending
                  ? "جاري إنشاء الموعد..."
                  : "إنشاء الموعد"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {appointments?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>المواعيد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(new Date(appointment.startTime).getTime() - 60 * 60 * 1000), "h:mm a")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getStudentName(appointment.studentId)}
                    </p>
                    <Badge
                      className="mt-2"
                      variant={
                        appointment.status === AppointmentStatus.PENDING
                          ? "outline"
                          : "default"
                      }
                    >
                      {AppointmentStatusArabic[appointment.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader>
              <CardTitle>المواعيد</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                لا توجد مواعيد لهذا اليوم
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
