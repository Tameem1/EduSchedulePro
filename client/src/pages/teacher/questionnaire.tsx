import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentStatusType } from "@shared/schema";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import type { User } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { Calendar, PlusCircle } from "lucide-react";
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
import { formatGMT3Time } from "@/lib/date-utils"; // <-- Import the GMT+3 helper

const AVAILABLE_TIMES = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "00:00",
];

export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentAppointment, setCurrentAppointment] =
    React.useState<Appointment | null>(null);
  const [formData, setFormData] = React.useState({
    question1: false,
    question2: false,
    question3: "",
    question4: "",
  });
  const [selectedStudent, setSelectedStudent] = React.useState<string>("");
  const [timeSliderValue, setTimeSliderValue] = React.useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const socketRef = React.useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();

  const connectWebSocket = React.useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log("Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'appointmentUpdate') {
          queryClient.invalidateQueries({
            queryKey: ["/api/teachers", user?.id, "appointments"],
          });

          // Update current appointment if it's the one that changed
          if (currentAppointment && data.data.appointment.id === currentAppointment.id) {
            setCurrentAppointment(data.data.appointment);
          }
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    socketRef.current = ws;
  }, [user?.id, currentAppointment]);

  React.useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Fetch all students
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

  // Fetch teacher's appointments
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  const getStudentName = (studentId: number) => {
    const student = students?.find((s) => s.id === studentId);
    return student?.username || `طالب ${studentId}`;
  };

  // Mutation to create an appointment
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
      setTimeSliderValue(0);
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

  // Handle creation of an appointment from the dialog
  const handleCreateAppointment = () => {
    if (!selectedStudent) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار الطالب",
        variant: "destructive",
      });
      return;
    }
    createAppointmentMutation.mutate({
      studentId: parseInt(selectedStudent),
      // For demonstration: "today's date plus chosen time"
      // In a real app, you'd pick an actual date or finalize logic
      startTime:
        new Date().toLocaleDateString("en-US") +
        " " +
        AVAILABLE_TIMES[timeSliderValue],
    });
  };

  // Mutation to submit the teacher's questionnaire
  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire-responses", {
        ...data,
        appointmentId: currentAppointment?.id,
        // Convert booleans into strings
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit questionnaire");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقييم",
        description: "تم حفظ إجاباتك بنجاح",
      });
      setFormData({
        question1: false,
        question2: false,
        question3: "",
        question4: "",
      });
      setCurrentAppointment(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/teachers", user?.id, "appointments"],
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ في إرسال التقييم",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit handler for the questionnaire form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestionnaireMutation.mutate(formData);
  };

  // Helper to pick a status color
  const getStatusColor = (status: AppointmentStatusType) => {
    return (
      {
        [AppointmentStatus.PENDING]: "bg-gray-500",
        [AppointmentStatus.REQUESTED]: "bg-blue-500",
        [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
        [AppointmentStatus.RESPONDED]: "bg-green-500",
        [AppointmentStatus.DONE]: "bg-purple-500",
      }[status] || "bg-gray-500"
    );
  };

  return (
    <div className="container mx-auto p-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">لوحة المعلم</h1>
        <div className="flex gap-2">
          <Link href="/teacher/availability">
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              إدارة التوفر
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                إضافة موعد لطالب
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>إضافة موعد جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-2">
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

                <div className="space-y-4">
                  <Label>اختر الوقت: {AVAILABLE_TIMES[timeSliderValue]}</Label>
                  <input
                    type="range"
                    min="0"
                    max={AVAILABLE_TIMES.length - 1}
                    value={timeSliderValue}
                    onChange={(e) =>
                      setTimeSliderValue(parseInt(e.target.value))
                    }
                    className="w-full"
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
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle>استبيان الموعد</CardTitle>
          <CardDescription>
            أكمل هذا النموذج بعد كل موعد مع طالب
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* If an appointment is currently selected, show the questionnaire */}
          {currentAppointment ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-md mb-4">
                <p>
                  <span className="font-semibold">الطالب:</span>{" "}
                  {getStudentName(currentAppointment.studentId)}
                </p>
                <p>
                  <span className="font-semibold">الوقت:</span>{" "}
                  {formatGMT3Time(new Date(currentAppointment.startTime))}
                </p>
                <Badge
                  className={`${getStatusColor(
                    currentAppointment.status as AppointmentStatusType,
                  )} text-white`}
                >
                  {
                    AppointmentStatusArabic[
                      currentAppointment.status as AppointmentStatusType
                    ]
                  }
                </Badge>
              </div>

              {/* If the appointment is REQUESTED, direct the teacher to accept it first */}
              {currentAppointment.status === AppointmentStatus.REQUESTED && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    يجب قبول الموعد أولاً قبل إكمال الاستبيان
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() =>
                      setLocation(
                        `/teacher/accept-appointment/${currentAppointment.id}`,
                      )
                    }
                  >
                    قبول الموعد
                  </Button>
                </div>
              )}

              {/* Always show the questionnaire fields once there's a currentAppointment */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    هل تمت متابعة الطالب؟
                  </label>
                  <Switch
                    checked={formData.question1}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, question1: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    هل استجاب الطالب للمتابعة؟
                  </label>
                  <Switch
                    checked={formData.question2}
                    onCheckedChange={async (checked) => {
                      setFormData({ ...formData, question2: checked });

                      if (checked && currentAppointment?.id) {
                        try {
                          await apiRequest(
                            "PATCH",
                            `/api/appointments/${currentAppointment.id}/response`,
                            { responded: true },
                          );

                          // Update status in local state
                          setCurrentAppointment({
                            ...currentAppointment,
                            status: AppointmentStatus.RESPONDED,
                          });

                          toast({
                            title: "تم تحديث الحالة",
                            description:
                              "تم تحديث حالة الموعد إلى تمت الاستجابة",
                          });

                          queryClient.invalidateQueries({
                            queryKey: [
                              "/api/teachers",
                              user?.id,
                              "appointments",
                            ],
                          });
                        } catch (error) {
                          console.error(
                            "Failed to update appointment status:",
                            error,
                          );
                          toast({
                            title: "خطأ في تحديث الحالة",
                            description: "فشل تحديث حالة الموعد",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    ماذا سمع؟
                  </label>
                  <Textarea
                    value={formData.question3}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        question3: e.target.value,
                      })
                    }
                    placeholder="سورة الاسراء"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    ملاحظات الجلسة
                  </label>
                  <Textarea
                    value={formData.question4}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        question4: e.target.value,
                      })
                    }
                    placeholder="أي ملاحظات إضافية عن الجلسة"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitQuestionnaireMutation.isPending}
                >
                  {submitQuestionnaireMutation.isPending
                    ? "جاري الإرسال..."
                    : "إرسال التقييم"}
                </Button>
              </div>
            </form>
          ) : (
            // If no appointment is selected, show a list to pick from
            <div className="py-8">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium">اختر موعداً</h3>
                <p className="text-muted-foreground">
                  اختر موعداً لإكمال الاستبيان
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
                  {appointments?.map((appointment) => (
                    <Card
                      key={appointment.id}
                      className={`cursor-pointer hover:border-primary ${
                        appointment.status === AppointmentStatus.DONE
                          ? "opacity-50"
                          : ""
                      }`}
                      onClick={() => {
                        if (appointment.status !== AppointmentStatus.DONE) {
                          setCurrentAppointment(appointment);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            {/* Show time in GMT+3 */}
                            <p className="font-medium">
                              {formatGMT3Time(new Date(appointment.startTime))}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getStudentName(appointment.studentId)}
                            </p>
                          </div>
                          <Badge
                            className={`${getStatusColor(
                              appointment.status as AppointmentStatusType,
                            )} text-white`}
                          >
                            {
                              AppointmentStatusArabic[
                                appointment.status as AppointmentStatusType
                              ]
                            }
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}