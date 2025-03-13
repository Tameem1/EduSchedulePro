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
    question1: false, // "هل تمت متابعة الطالب؟"
    question2: false, // "هل استجاب الطالب للمتابعة؟"
    question3: "", // "ماذا سمع؟"
    question4: "", // "ملاحظات الجلسة"
  });

  // We'll store the *single appointment* found by filtering the teacher’s appointments
  const [currentAppointment, setCurrentAppointment] =
    React.useState<Appointment | null>(null);

  // We'll also store a mapping of studentId → studentName from /api/users/students
  const [studentsMap, setStudentsMap] = React.useState<Record<number, string>>(
    {},
  );

  // =========== Must be a Teacher ===========
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

  // =========== 1) Fetch the teacher's appointments, as in the old code ===========
  const {
    data: teacherAppointments,
    isLoading: loadingAppointments,
    isError: errorAppointments,
    error: appointmentsError,
  } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      // mimic old code: get all teacher appointments
      const res = await apiRequest(
        "GET",
        `/api/teachers/${user.id}/appointments`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch teacher appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
    onSuccess: (appts) => {
      // Once we have all appointments, find the one matching param
      const apt = appts.find((a) => a.id === parseInt(appointmentId ?? ""));
      setCurrentAppointment(apt || null);
    },
  });

  // =========== 2) Fetch all students, to get their real names just like old code ===========
  const {
    data: allStudents,
    isLoading: loadingStudents,
    isError: errorStudents,
  } = useQuery<User[]>({
    queryKey: ["/api/users/students"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/students");
      if (!res.ok) {
        throw new Error("Failed to fetch students");
      }
      return res.json();
    },
    enabled: !!user,
    onSuccess: (list) => {
      const map: Record<number, string> = {};
      list.forEach((s) => {
        map[s.id] = s.username;
      });
      setStudentsMap(map);
    },
  });

  // =========== 3) WebSocket logic for real-time updates, as in old code ===========
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();
  const reconnectAttempts = React.useRef(0);
  const [wsConnected, setWsConnected] = React.useState(false);

  const connectWebSocket = React.useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN)
      return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log("Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
      reconnectAttempts.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "appointmentUpdate") {
          // Invalidate the teacher’s appointments to keep everything in sync
          queryClient.invalidateQueries([
            "/api/teachers",
            user?.id,
            "appointments",
          ]);

          // If we have a current apt, see if it's the one updated
          if (currentAppointment && data.data?.appointment) {
            const updated = data.data.appointment;
            if (updated.id === currentAppointment.id) {
              setCurrentAppointment((prev) =>
                prev ? { ...prev, ...updated } : prev,
              );
              // Possibly show a toast if it changed from REQUESTED => ASSIGNED, etc.
            }
          }
        }
      } catch (err) {
        console.error("Error handling WS message:", err);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);
      setWsConnected(false);
      reconnectAttempts.current++;
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    socketRef.current = ws;
  }, [currentAppointment, user?.id]);

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

  // =========== 4) Toggling question #2 => "responded" patch logic from old code ===========
  async function handleQuestion2Toggle(checked: boolean) {
    setFormData((prev) => ({ ...prev, question2: checked }));

    if (checked && currentAppointment?.id) {
      try {
        const res = await apiRequest(
          "PATCH",
          `/api/appointments/${currentAppointment.id}/response`,
          { responded: true },
        );
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to mark responded");
        }
        // Mark local apt as responded
        setCurrentAppointment((prev) => {
          if (!prev) return null;
          return { ...prev, status: AppointmentStatus.RESPONDED };
        });
        toast({
          title: "تم تحديث الحالة",
          description: "تم تحديث حالة الموعد إلى استجاب الطالب",
        });
        queryClient.invalidateQueries([
          "/api/teachers",
          user?.id,
          "appointments",
        ]);
      } catch (err: any) {
        toast({
          title: "خطأ",
          description: err.message,
          variant: "destructive",
        });
      }
    }
  }

  // =========== 5) Submit questionnaire => "questionnaire-responses" post logic ===========
  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: {
      question1: boolean;
      question2: boolean;
      question3: string;
      question4: string;
      appointmentId: number;
    }) => {
      const body = {
        appointmentId: data.appointmentId,
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
        question3: data.question3,
        question4: data.question4,
      };
      const res = await apiRequest(
        "POST",
        "/api/questionnaire-responses",
        body,
      );
      if (!res.ok) {
        const errJs = await res.json();
        throw new Error(errJs.error || "Failed to submit questionnaire");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقييم",
        description: "تم حفظ إجاباتك بنجاح",
      });
      // Mark apt as DONE if you want
      setCurrentAppointment((prev) => {
        if (!prev) return null;
        return { ...prev, status: AppointmentStatus.DONE };
      });
      // Clear form
      setFormData({
        question1: false,
        question2: false,
        question3: "",
        question4: "",
      });
      // Invalidate teacher appointments
      queryClient.invalidateQueries([
        "/api/teachers",
        user?.id,
        "appointments",
      ]);
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
    if (!currentAppointment) {
      toast({ title: "لا يوجد موعد", variant: "destructive" });
      return;
    }
    submitQuestionnaireMutation.mutate({
      question1: formData.question1,
      question2: formData.question2,
      question3: formData.question3,
      question4: formData.question4,
      appointmentId: currentAppointment.id,
    });
  }

  // =========== 6) RENDER ===============
  if (loadingAppointments || loadingStudents) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (errorAppointments) {
    return (
      <div className="p-4">
        <p>فشل جلب مواعيد المعلم: {(appointmentsError as Error)?.message}</p>
      </div>
    );
  }
  // We have teacherAppointments, but let's see if the chosen one is found
  if (!currentAppointment) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent>
            <p className="text-center text-muted-foreground">
              لا يوجد موعد بهذه الهوية أو لم يتم جلبه بعد...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const studentName =
    studentsMap[currentAppointment.studentId] ||
    `طالب #${currentAppointment.studentId}`;

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
              {formatGMT3Time(new Date(currentAppointment.startTime))}{" "}
              &nbsp;—&nbsp;
              {format(new Date(currentAppointment.startTime), "MMM d, yyyy")}
            </p>
            <p>
              <span className="font-semibold">الطالب: </span>
              {studentName}
            </p>
            <Badge
              className={`mt-2 text-white ${getStatusColor(currentAppointment.status)}`}
            >
              {AppointmentStatusArabic[currentAppointment.status]}
            </Badge>
          </div>

          {/* "Back" button */}
          <div className="text-right mb-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/teacher/appointments")}
            >
              العودة إلى المواعيد
            </Button>
          </div>

          {/* The old logic says if appointment is only PENDING or REQUESTED, etc. you might show warnings,
              but we'll let them fill anyway.  
          */}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Q1 */}
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

            {/* Q2 => triggers patch if toggled on */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                هل استجاب الطالب للمتابعة؟
              </label>
              <Switch
                checked={formData.question2}
                onCheckedChange={handleQuestion2Toggle}
              />
            </div>

            {/* Q3 */}
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

            {/* Q4 */}
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

            {/* Submit */}
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
