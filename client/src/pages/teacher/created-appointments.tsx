import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, parseISO, isToday } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { formatGMT3Time } from "@/lib/date-utils";
import { Loader2, CalendarIcon, ArrowLeft, Pencil } from "lucide-react";
import { Link } from "wouter";
import { 
  AppointmentStatus, 
  AppointmentStatusArabic, 
  type Appointment,
  type User,
  type QuestionnaireResponse
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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

export default function TeacherCreatedAppointments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Dialog state for editing appointment
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [editFormData, setEditFormData] = React.useState({
    teacherAssignment: "",
    startTime: ""
  });
  
  // Track questionnaire responses
  const [questionnaireResponses, setQuestionnaireResponses] = React.useState<Record<number, QuestionnaireResponse | null>>({});
  
  // Debug log to track component mounting
  React.useEffect(() => {
    console.log("Created appointments page loaded successfully!");
    
    return () => {
      console.log("TeacherCreatedAppointments component unmounted");
    };
  }, [user]);
  
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
  
  // Get all teachers for displaying names 
  const { data: teachers } = useQuery<User[]>({
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
  
  // Function to get questionnaire response for an appointment
  const getQuestionnaireResponse = async (appointmentId: number) => {
    try {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}/questionnaire`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error("Error fetching questionnaire response:", error);
      return null;
    }
  };
  
  // Helper function to fetch a single questionnaire response and update state
  const fetchQuestionnaireForAppointment = async (appointmentId: number) => {
    try {
      console.log(`Fetching questionnaire for appointment ID: ${appointmentId}`);
      const response = await getQuestionnaireResponse(appointmentId);
      
      setQuestionnaireResponses(prev => ({
        ...prev,
        [appointmentId]: response
      }));
      
      console.log(`Updated questionnaire response for appointment ${appointmentId}:`, response);
      return response;
    } catch (error) {
      console.error(`Error fetching questionnaire for appointment ${appointmentId}:`, error);
      return null;
    }
  };
  
  // Helper to get student name
  function getStudentName(id: number) {
    if (!students) return `طالب #${id}`;
    const student = students.find((s) => s.id === id);
    return student ? student.username : `طالب #${id}`;
  }
  
  // Helper to get teacher name
  function getTeacherName(id: number) {
    if (!teachers) return `معلم #${id}`;
    const teacher = teachers.find((t) => t.id === id);
    return teacher ? teacher.username : `معلم #${id}`;
  }
  
  // Fetch questionnaire responses for completed appointments
  React.useEffect(() => {
    if (!createdAppointments) return;
    
    const fetchQuestionnaireResponses = async () => {
      const doneAppointments = createdAppointments.filter(
        appointment => appointment.status === AppointmentStatus.DONE
      );
      
      const responses: Record<number, QuestionnaireResponse | null> = {};
      
      for (const appointment of doneAppointments) {
        const response = await getQuestionnaireResponse(appointment.id);
        responses[appointment.id] = response;
      }
      
      setQuestionnaireResponses(responses);
    };
    
    fetchQuestionnaireResponses();
  }, [createdAppointments]);
  
  // Setup WebSocket connection for real-time updates
  React.useEffect(() => {
    if (!user?.id) return;
    
    // Define the message handler function inside the effect
    // to avoid dependency issues with fetchQuestionnaireForAppointment
    const handleWebSocketMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);
        
        // Handle appointment updates
        if (data.type === "appointmentUpdate") {
          console.log("Received appointment update:", data);
          
          // Invalidate relevant queries to refresh data
          queryClient.invalidateQueries({ 
            queryKey: ["/api/teachers", user.id, "created-appointments"] 
          });
          
          // For DONE appointments or if status is changed to DONE, refresh questionnaire data
          const appointment = data.data?.appointment;
          if (appointment) {
            try {
              console.log(`Fetching questionnaire for appointment ID: ${appointment.id}`);
              const response = await getQuestionnaireResponse(appointment.id);
              
              setQuestionnaireResponses(prev => ({
                ...prev,
                [appointment.id]: response
              }));
              
              console.log(`Updated questionnaire response for appointment ${appointment.id}:`, response);
            } catch (error) {
              console.error(`Error fetching questionnaire for appointment ${appointment.id}:`, error);
            }
          }
        }
        
        // Handle questionnaire response updates
        if (data.type === "questionnaireResponse") {
          console.log("Received questionnaire response update:", data);
          
          const appointmentId = data.data?.appointmentId;
          if (appointmentId) {
            try {
              console.log(`Fetching questionnaire for appointment ID: ${appointmentId}`);
              const response = await getQuestionnaireResponse(appointmentId);
              
              setQuestionnaireResponses(prev => ({
                ...prev,
                [appointmentId]: response
              }));
              
              console.log(`Updated questionnaire response for appointment ${appointmentId}:`, response);
              
              // Also refresh the appointments list to ensure we have latest status
              queryClient.invalidateQueries({ 
                queryKey: ["/api/teachers", user.id, "created-appointments"] 
              });
            } catch (error) {
              console.error(`Error fetching questionnaire for appointment ${appointmentId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };
    
    console.log("Connecting to WebSocket:", `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`);
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    socket.addEventListener("open", () => {
      console.log("WebSocket connected");
    });
    
    socket.addEventListener("message", handleWebSocketMessage);
    
    socket.addEventListener("close", () => {
      console.log("WebSocket disconnected");
    });
    
    socket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });
    
    // Cleanup WebSocket on unmount
    return () => {
      socket.close();
    };
  }, [user?.id, queryClient, getQuestionnaireResponse]);
  
  // Mutation for updating appointments
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, data }: { appointmentId: number; data: any }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/appointments/${appointmentId}`,
        data
      );
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث الموعد",
        description: "تم تحديث تفاصيل الموعد بنجاح",
      });
      // Close the dialog and reset form
      setIsEditDialogOpen(false);
      setSelectedAppointment(null);
      
      // Refresh appointments list
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "created-appointments"]
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تحديث الموعد",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handler for opening the edit dialog
  const handleEditClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    
    // Format the time string to "yyyy-MM-ddTHH:mm" for datetime-local input
    // The database stores time as "YYYY-MM-DD HH:MM:SS" format
    const startTimeStr = String(appointment.startTime); // Ensure it's a string
    const formattedTime = startTimeStr.replace(' ', 'T').slice(0, 16);
    
    setEditFormData({
      teacherAssignment: appointment.teacherAssignment || "",
      startTime: formattedTime
    });
    
    setIsEditDialogOpen(true);
  };
  
  // Handler for submitting the edit form
  const handleEditSubmit = () => {
    if (!selectedAppointment) return;
    
    const data: any = {};
    
    // Only include fields that have changed
    if (editFormData.teacherAssignment !== selectedAppointment.teacherAssignment) {
      data.teacherAssignment = editFormData.teacherAssignment;
    }
    
    // Check if time has changed - we compare the formatted strings
    const startTimeStr = String(selectedAppointment.startTime);
    const originalFormatted = startTimeStr.replace(' ', 'T').slice(0, 16);
    
    if (editFormData.startTime !== originalFormatted) {
      // Just pass the datetime-local value directly
      data.startTime = editFormData.startTime;
      console.log("Time changed from", originalFormatted, "to", editFormData.startTime);
    }
    
    // Only proceed if there are changes
    if (Object.keys(data).length === 0) {
      toast({
        title: "لم يتم إجراء أي تغييرات",
        description: "لم تقم بتغيير أي من بيانات الموعد",
      });
      return;
    }
    
    updateAppointmentMutation.mutate({
      appointmentId: selectedAppointment.id,
      data
    });
  };
  
  // Filter appointments for today only
  const todayAppointments = React.useMemo(() => {
    if (!createdAppointments) return [];
    return createdAppointments.filter(appointment => 
      isToday(new Date(appointment.startTime))
    );
  }, [createdAppointments]);

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

      {todayAppointments && todayAppointments.length > 0 ? (
        <Card className="border-t-4" style={{ borderTopColor: "hsl(222.2 47.4% 11.2%)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              المواعيد التي قمت بإنشائها اليوم
            </CardTitle>
            <CardDescription>
              هنا يمكنك رؤية المواعيد التي قمت بإنشائها للطلاب اليوم
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.length > 0 ? (
                todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border rounded-lg transition-colors duration-200"
                    style={{ borderColor: "#e2e8f0" }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "hsl(222.2 47.4% 11.2%)"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                          <p className="font-medium text-lg">
                            {formatGMT3Time(new Date(appointment.startTime))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(appointment.startTime), "EEEE, d MMMM yyyy")}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <p className="text-sm">
                            <span className="font-medium">الطالب:</span> {getStudentName(appointment.studentId)}
                          </p>
                          
                          {appointment.teacherId && (
                            <p className="text-sm">
                              <span className="font-medium">المعلم المعين:</span> {getTeacherName(appointment.teacherId)}
                            </p>
                          )}
                        </div>
                        
                        {appointment.teacherAssignment && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">المهمة:</span> {appointment.teacherAssignment}
                          </p>
                        )}
                        
                        {/* Display questionnaire response question3 for completed appointments */}
                        {appointment.status === AppointmentStatus.DONE && 
                         questionnaireResponses[appointment.id]?.question3 && (
                          <p className="text-sm mt-2 p-2 bg-muted rounded-md">
                            <span className="font-medium">ماذا سمع الطالب:</span> {questionnaireResponses[appointment.id]?.question3}
                          </p>
                        )}
                        
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                          <Badge className={`text-white ${getStatusColor(appointment.status)}`}>
                            {AppointmentStatusArabic[appointment.status]}
                          </Badge>
                          
                          {/* Add Edit Button */}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mr-2 flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(appointment);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            تعديل
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  لا توجد مواعيد اليوم
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لم تقم بإنشاء أي مواعيد اليوم</p>
            <p className="mt-2">يمكنك إنشاء مواعيد جديدة من صفحة المواعيد</p>
            <Link href="/teacher/appointments">
              <Button 
                variant="outline" 
                className="mt-4"
              >
                العودة إلى المواعيد
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
      
      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل تفاصيل الموعد</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">الوقت</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={editFormData.startTime}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  startTime: e.target.value
                }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="teacherAssignment">المهمة</Label>
              <Input
                id="teacherAssignment"
                value={editFormData.teacherAssignment}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  teacherAssignment: e.target.value
                }))}
                placeholder="المهمة للطالب"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button 
              type="button" 
              onClick={handleEditSubmit} 
              disabled={updateAppointmentMutation.isPending}
            >
              {updateAppointmentMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}