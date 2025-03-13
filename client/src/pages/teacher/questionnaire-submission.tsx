import * as React from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

import {
  Appointment,
  AppointmentStatus,
  AppointmentStatusType,
  AppointmentStatusArabic,
  User,
} from "@shared/schema";
import { format } from "date-fns";
import { formatGMT3Time } from "@/lib/date-utils";

function getStatusColor(status: AppointmentStatusType) {
  return (
    {
      [AppointmentStatus.PENDING]: "bg-gray-500",
      [AppointmentStatus.REQUESTED]: "bg-blue-500",
      [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
      [AppointmentStatus.RESPONDED]: "bg-green-500",
      [AppointmentStatus.DONE]: "bg-purple-500",
    }[status] || "bg-gray-500"
  );
}

export default function TeacherQuestionnaireSubmission() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [, setLocation] = useLocation();

  // Local form data
  const [formData, setFormData] = React.useState({
    question1: false,
    question2: false,
    question3: "",
    question4: "",
  });

  // Fetch single appointment directly
  const {
    data: appointment,
    isLoading: loadingAppointment,
    isError: appointmentError,
  } = useQuery<Appointment>({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch appointment");
      }
      return res.json();
    },
    enabled: !!appointmentId && !!user?.id,
  });

  // Fetch student details if we have an appointment
  const {
    data: student,
    isLoading: loadingStudent,
    isError: studentError,
  } = useQuery<User>({
    queryKey: ["/api/users", appointment?.studentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${appointment?.studentId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch student details");
      }
      return res.json();
    },
    enabled: !!appointment?.studentId,
  });

  // WebSocket setup
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();
  const [wsConnected, setWsConnected] = React.useState(false);

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

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "appointmentUpdate") {
          // Invalidate the appointment query to refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/appointments", appointmentId] });
        }
      } catch (err) {
        console.error("Error handling WS message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setWsConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    socketRef.current = ws;
  }, [appointmentId]);

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

  // Handle student response toggle
  async function handleQuestion2Toggle(checked: boolean) {
    setFormData((prev) => ({ ...prev, question2: checked }));

    if (checked && appointmentId) {
      try {
        const res = await apiRequest(
          "PATCH",
          `/api/appointments/${appointmentId}/response`,
          { responded: true }
        );
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to mark as responded");
        }
        toast({
          title: "تم تحديث الحالة",
          description: "تم تحديث حالة الموعد إلى استجاب الطالب",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/appointments", appointmentId] });
      } catch (err: any) {
        toast({
          title: "خطأ",
          description: err.message,
          variant: "destructive",
        });
      }
    }
  }

  // Submit questionnaire
  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: {
      question1: boolean;
      question2: boolean;
      question3: string;
      question4: string;
      appointmentId: string;
    }) => {
      const res = await apiRequest("POST", "/api/questionnaire-responses", {
        appointmentId: parseInt(data.appointmentId),
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
        question3: data.question3,
        question4: data.question4,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit questionnaire");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقييم",
        description: "تم حفظ إجاباتك بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", appointmentId] });
      setLocation("/teacher/appointments");
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في إرسال التقييم",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointmentId) {
      toast({ title: "لا يوجد موعد", variant: "destructive" });
      return;
    }
    submitQuestionnaireMutation.mutate({
      ...formData,
      appointmentId,
    });
  }

  // Loading states
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (user.role !== "teacher") {
    return (
      <div className="p-4">
        <p>ليس لديك الصلاحية لدخول هذه الصفحة (تحتاج حساب معلم)</p>
      </div>
    );
  }

  if (loadingAppointment || loadingStudent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (appointmentError || !appointment) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              لا يوجد موعد بهذه الهوية أو لم يتم جلبه بعد...
            </p>
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setLocation("/teacher/appointments")}>
                العودة إلى المواعيد
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get student name from fetched student data
  const studentName = student?.username || `طالب #${appointment.studentId}`;

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>استبيان الموعد</CardTitle>
          <CardDescription>
            الرجاء إكمال هذا النموذج بعد انتهاء الموعد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-md mb-6">
            <p>
              <span className="font-semibold">الوقت: </span>
              {formatGMT3Time(new Date(appointment.startTime))}{" "}
              &nbsp;—&nbsp;
              {format(new Date(appointment.startTime), "MMM d, yyyy")}
            </p>
            <p>
              <span className="font-semibold">الطالب: </span>
              {studentName}
            </p>
            <Badge
              className={`mt-2 text-white ${getStatusColor(appointment.status)}`}
            >
              {AppointmentStatusArabic[appointment.status]}
            </Badge>
          </div>

          <div className="text-right mb-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/teacher/appointments")}
            >
              العودة إلى المواعيد
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                هل تمت متابعة الطالب؟
              </label>
              <Switch
                checked={formData.question1}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, question1: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                هل استجاب الطالب للمتابعة؟
              </label>
              <Switch
                checked={formData.question2}
                onCheckedChange={handleQuestion2Toggle}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                ماذا سمع؟
              </label>
              <Textarea
                placeholder="مثال: سورة الإسراء..."
                required
                value={formData.question3}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    question3: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                ملاحظات الجلسة
              </label>
              <Textarea
                placeholder="أي ملاحظات إضافية عن الجلسة"
                required
                value={formData.question4}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    question4: e.target.value,
                  }))
                }
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}