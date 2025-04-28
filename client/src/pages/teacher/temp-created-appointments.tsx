import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { formatGMT3Time } from "@/lib/date-utils";
import { Loader2, CalendarIcon, ArrowLeft } from "lucide-react";
import { 
  AppointmentStatus, 
  AppointmentStatusArabic, 
  type Appointment,
  type User
} from "@shared/schema";

// UI Components
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper function to determine status color
function getStatusColor(status: string) {
  return {
    [AppointmentStatus.PENDING]: "bg-gray-400",
    [AppointmentStatus.REQUESTED]: "bg-blue-500",
    [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
    [AppointmentStatus.RESPONDED]: "bg-green-500",
    [AppointmentStatus.DONE]: "bg-purple-500",
    [AppointmentStatus.REJECTED]: "bg-red-500",
  }[status] || "bg-gray-500";
}

export default function TempCreatedAppointments() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("all");

  // Get appointments created by the teacher
  const { data: createdAppointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "created-appointments"],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const res = await apiRequest(
        "GET", 
        `/api/teachers/${user.id}/created-appointments`
      );
      
      if (!res.ok) {
        throw new Error("Failed to fetch created appointments");
      }
      
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Get all students for displaying names
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Helper to get student name
  function getStudentName(id: number) {
    if (!students) return `طالب #${id}`;
    const student = students.find((s) => s.id === id);
    return student ? student.username : `طالب #${id}`;
  }

  // Filter appointments based on active tab
  const filteredAppointments = React.useMemo(() => {
    if (!createdAppointments) return [];
    
    if (activeTab === "all") {
      return createdAppointments;
    }
    
    // Filter by status based on the active tab
    const statusMap: Record<string, string> = {
      "pending": AppointmentStatus.PENDING,
      "requested": AppointmentStatus.REQUESTED,
      "assigned": AppointmentStatus.ASSIGNED,
      "responded": AppointmentStatus.RESPONDED,
      "done": AppointmentStatus.DONE,
      "rejected": AppointmentStatus.REJECTED,
    };
    
    return createdAppointments.filter(
      appointment => appointment.status === statusMap[activeTab]
    );
  }, [createdAppointments, activeTab]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center gap-4 mb-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">
          المواعيد التي أنشأتها
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4 ml-1" />
              العودة إلى المواعيد
            </Button>
          </Link>
        </div>
      </div>

      {createdAppointments && createdAppointments.length > 0 ? (
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              المواعيد التي قمت بإنشائها
            </CardTitle>
            <CardDescription>
              هنا يمكنك رؤية جميع المواعيد التي قمت بإنشائها للطلاب
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 md:grid-cols-7 mb-4">
                <TabsTrigger value="all">الكل ({createdAppointments.length})</TabsTrigger>
                <TabsTrigger value="pending">معلق ({createdAppointments.filter(a => a.status === AppointmentStatus.PENDING).length})</TabsTrigger>
                <TabsTrigger value="requested">مطلوب ({createdAppointments.filter(a => a.status === AppointmentStatus.REQUESTED).length})</TabsTrigger>
                <TabsTrigger value="assigned">معين ({createdAppointments.filter(a => a.status === AppointmentStatus.ASSIGNED).length})</TabsTrigger>
                <TabsTrigger value="responded">تمت الاستجابة ({createdAppointments.filter(a => a.status === AppointmentStatus.RESPONDED).length})</TabsTrigger>
                <TabsTrigger value="done">منجز ({createdAppointments.filter(a => a.status === AppointmentStatus.DONE).length})</TabsTrigger>
                <TabsTrigger value="rejected">مرفوض ({createdAppointments.filter(a => a.status === AppointmentStatus.REJECTED).length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="mt-0">
                <div className="space-y-4">
                  {filteredAppointments.length > 0 ? (
                    filteredAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="p-4 border rounded-lg hover:border-primary transition-colors duration-200"
                      >
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div>
                            <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                              <p className="font-medium text-lg">
                                {formatGMT3Time(new Date(appointment.startTime))}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(appointment.startTime), "EEEE, d MMMM yyyy")}
                              </p>
                            </div>
                            
                            <p className="text-sm mt-2">
                              <span className="font-medium">الطالب:</span> {getStudentName(appointment.studentId)}
                            </p>
                            
                            {appointment.teacherAssignment && (
                              <p className="text-sm mt-1">
                                <span className="font-medium">المهمة:</span> {appointment.teacherAssignment}
                              </p>
                            )}
                            
                            <div className="mt-3">
                              <Badge className={`text-white ${getStatusColor(appointment.status)}`}>
                                {AppointmentStatusArabic[appointment.status]}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {appointment.status !== AppointmentStatus.REJECTED && (
                              <Link href={`/teacher/questionnaire-submission/${appointment.id}`}>
                                <Button variant="outline" size="sm">
                                  استعراض الاستبيان
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      لا توجد مواعيد بهذه الحالة
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              إجمالي المواعيد: {createdAppointments.length}
            </p>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لم تقم بإنشاء أي مواعيد بعد</p>
            <p className="mt-2">يمكنك إنشاء مواعيد جديدة من صفحة المواعيد</p>
            <Link href="/teacher/appointments" className="mt-4 inline-block">
              <Button variant="outline">العودة إلى المواعيد</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}