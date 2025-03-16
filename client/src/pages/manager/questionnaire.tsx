import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { Loader2, ArrowLeft } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, User } from "@shared/schema";
import { AppointmentStatus } from "@shared/schema";

export default function ManagerQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = React.useState("");
  const [formData, setFormData] = React.useState({
    question1: false, // هل تمت متابعة الطالب
    question2: false, // هل استجاب الطالب للمتابعة
    question3: "", // ماذا سمع
    question4: "", // ملاحظات الجلسة
  });

  // Fetch appointments that don't have questionnaire responses
  const { data: appointments, isLoading: loadingAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/without-questionnaire"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/appointments/without-questionnaire");
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch students for displaying names
  const { data: students, isLoading: loadingStudents } = useQuery<User[]>({
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

  // Submit questionnaire mutation
  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: {
      appointmentId: string;
      question1: boolean;
      question2: boolean;
      question3: string;
      question4: string;
    }) => {
      // First update the appointment status to reflect the response
      if (data.question2) {
        await apiRequest(
          "PATCH",
          `/api/appointments/${data.appointmentId}/response`,
          { responded: true }
        );
      }

      const res = await apiRequest("POST", "/api/questionnaire-responses", {
        appointmentId: parseInt(data.appointmentId),
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
        question3: data.question3,
        question4: data.question4,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to submit questionnaire");
      }

      // If successful, also update the appointment status to DONE
      await apiRequest(
        "PATCH",
        `/api/appointments/${data.appointmentId}`,
        { status: AppointmentStatus.DONE }
      );

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقييم",
        description: "تم حفظ إجابات الاستبيان بنجاح",
      });
      setSelectedAppointment("");
      setFormData({
        question1: false,
        question2: false,
        question3: "",
        question4: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/without-questionnaire"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إرسال التقييم",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get student name helper
  const getStudentName = (studentId: number) => {
    const student = students?.find(s => s.id === studentId);
    return student?.username || `طالب ${studentId}`;
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppointment) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار موعد",
        variant: "destructive",
      });
      return;
    }
    submitQuestionnaireMutation.mutate({
      appointmentId: selectedAppointment,
      ...formData,
    });
  }

  // Loading state
  if (!user || user.role !== "manager" || loadingAppointments || loadingStudents) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">
      <div className="mb-4">
        <Link href="/manager/appointments">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            العودة إلى المواعيد
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إضافة نتيجة استبيان</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>اختر الموعد</Label>
              <Select
                value={selectedAppointment}
                onValueChange={setSelectedAppointment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر موعداً" />
                </SelectTrigger>
                <SelectContent>
                  {appointments?.map((appointment) => (
                    <SelectItem
                      key={appointment.id}
                      value={String(appointment.id)}
                    >
                      {format(new Date(appointment.startTime), "yyyy/MM/dd HH:mm")} -{" "}
                      {getStudentName(appointment.studentId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>هل تمت متابعة الطالب؟</Label>
              <Switch
                checked={formData.question1}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, question1: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>هل استجاب الطالب للمتابعة؟</Label>
              <Switch
                checked={formData.question2}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, question2: checked }))
                }
              />
            </div>

            <div>
              <Label>ماذا سمع؟</Label>
              <Textarea
                placeholder="مثال: سورة الإسراء..."
                value={formData.question3}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, question3: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label>ملاحظات الجلسة</Label>
              <Textarea
                placeholder="أي ملاحظات إضافية عن الجلسة"
                value={formData.question4}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, question4: e.target.value }))
                }
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
