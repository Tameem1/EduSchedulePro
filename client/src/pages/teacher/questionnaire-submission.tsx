import * as React from "react";
import { useParams, useLocation, Link } from "wouter";
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
      [AppointmentStatus.REJECTED]: "bg-red-500",
    }[status] || "bg-gray-500"
  );
}

const TeacherQuestionnaireSubmission = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const [, setLocation] = useLocation();

  // Local form data
  const [formData, setFormData] = React.useState({
    attended: true, // Did the student attend? Default is yes
    question1: false,
    question2: false,
    question3: "",
    question4: "",
  });

  // Fetch appointment details
  const {
    data: appointment,
    isLoading: loadingAppointment,
    isError: appointmentError,
    error: appointmentErrorDetails,
  } = useQuery<Appointment>({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      if (!appointmentId) throw new Error("No appointment ID provided");

      const res = await apiRequest("GET", `/api/appointments/${appointmentId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch appointment");
      }
      return res.json();
    },
    enabled: !!appointmentId && !!user?.id,
    retry: 1,
  });

  // Fetch student details
  const { data: student, isLoading: loadingStudent } = useQuery<User>({
    queryKey: ["/api/users", appointment?.studentId],
    queryFn: async () => {
      if (!appointment?.studentId) throw new Error("No student ID available");

      const res = await apiRequest(
        "GET",
        `/api/users/${appointment.studentId}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch student details");
      }
      return res.json();
    },
    enabled: !!appointment?.studentId,
  });

  // Add debug logging for appointment data
  React.useEffect(() => {
    if (appointment) {
      console.log("Appointment data in questionnaire:", appointment);
    }
  }, [appointment]);

  // Handle form submission
  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: {
      attended: boolean;
      question1: boolean;
      question2: boolean;
      question3: string;
      question4: string;
      appointmentId: string;
    }) => {
      // If the student didn't attend, update the appointment status
      if (!data.attended && appointmentId) {
        try {
          await apiRequest(
            "PATCH",
            `/api/appointments/${appointmentId}`,
            { status: AppointmentStatus.NOT_ATTENDED }
          );
        } catch (error) {
          console.error("Failed to update appointment status to not attended", error);
        }
      }
      
      // For non-attending students, use placeholder values for required fields if empty
      const question3 = !data.attended && !data.question3 ? "لم يحضر الطالب" : data.question3;
      const question4 = !data.attended && !data.question4 ? "لم يحضر الطالب" : data.question4;
      
      const res = await apiRequest("POST", "/api/questionnaire-responses", {
        appointmentId: parseInt(data.appointmentId),
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
        question3: question3,
        question4: question4,
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
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments", appointmentId],
      });
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

  // Handle question2 toggle (student response)
  async function handleQuestion2Toggle(checked: boolean) {
    setFormData((prev) => ({ ...prev, question2: checked }));

    if (checked && appointmentId) {
      try {
        const res = await apiRequest(
          "PATCH",
          `/api/appointments/${appointmentId}/response`,
          { responded: true },
        );
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to mark as responded");
        }
        toast({
          title: "تم تحديث الحالة",
          description: "تم تحديث حالة الموعد إلى استجاب الطالب",
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments", appointmentId],
        });
      } catch (err: any) {
        toast({
          title: "خطأ",
          description: err.message,
          variant: "destructive",
        });
      }
    }
  }

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

  // Loading states and authorization checks
  if (!user) {
    setLocation("/auth");
    return null;
  }

  if (user.role !== "teacher") {
    return (
      <div className="p-4">
        <p>ليس لديك الصلاحية لدخول هذه الصفحة (تحتاج حساب معلم)</p>
      </div>
    );
  }

  if (!appointmentId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              لم يتم تحديد موعد للتقييم
            </p>
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setLocation("/teacher/appointments")}
              >
                العودة إلى المواعيد
              </Button>
            </div>
          </CardContent>
        </Card>
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
              {appointmentErrorDetails?.message ||
                "لا يوجد موعد بهذه الهوية أو لم يتم جلبه بعد..."}
            </p>
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setLocation("/teacher/appointments")}
              >
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
      <Button
        variant="outline"
        className="flex items-center gap-2 w-full sm:w-auto mb-4"
        onClick={() => setLocation("/teacher/appointments")}
      >
        ← العودة إلى المواعيد
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>استبيان الموعد</CardTitle>
          <CardDescription>
            الرجاء إكمال هذا النموذج بعد انتهاء الموعد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-md mb-6">
            <div className="mb-2">
              <span className="font-semibold block sm:inline">الوقت: </span>
              <span className="block sm:inline">{formatGMT3Time(new Date(appointment.startTime))} &nbsp;—&nbsp;
              {format(new Date(appointment.startTime), "MMM d, yyyy")}</span>
            </div>
            <div className="mb-2">
              <span className="font-semibold block sm:inline">الطالب: </span>
              <span className="block sm:inline">{studentName}</span>
            </div>

            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <h3 className="font-semibold mb-2">المهمة المطلوبة:</h3>
              <p className="text-muted-foreground break-words">
                {appointment.teacherAssignment}
              </p>
            </div>
            <Badge
              className={`mt-4 text-white ${getStatusColor(appointment.status)}`}
            >
              {AppointmentStatusArabic[appointment.status]}
            </Badge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <label className="text-sm font-medium mb-1 sm:mb-0 font-semibold text-primary">
                هل حضر الطالب الموعد؟
              </label>
              <Switch
                checked={formData.attended}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, attended: checked }))
                }
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <label className="text-sm font-medium mb-1 sm:mb-0">
                هل تمت متابعة الطالب؟
              </label>
              <Switch
                checked={formData.question1}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, question1: checked }))
                }
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <label className="text-sm font-medium mb-1 sm:mb-0">
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
                required={formData.attended}
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
                required={formData.attended}
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
};

export default TeacherQuestionnaireSubmission;
