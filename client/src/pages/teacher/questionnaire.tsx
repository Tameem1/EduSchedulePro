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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "@shared/schema";

export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentAppointment, setCurrentAppointment] = React.useState<Appointment | null>(null);
  const [formData, setFormData] = React.useState({
    question1: "",
    question2: "",
    question3: "",
    question4: "",
  });

  // Fetch teacher's appointments
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/teachers", user?.id, "appointments"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest("GET", `/api/teachers/${user.id}/appointments`);
      if (!res.ok) {
        throw new Error("Failed to fetch appointments");
      }
      return res.json();
    },
    enabled: !!user?.id,
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST",
        "/api/questionnaire-responses",
        {
          ...data,
          appointmentId: currentAppointment?.id,
        }
      );
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

      // Reset form and current appointment
      setFormData({
        question1: "",
        question2: "",
        question3: "",
        question4: "",
      });
      setCurrentAppointment(null);

      // Invalidate appointments query to refresh the list
      queryClient.invalidateQueries({ 
        queryKey: ["/api/teachers", user?.id, "appointments"] 
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestionnaireMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">جاري التحميل...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>استبيان الموعد</CardTitle>
          <CardDescription>
            أكمل هذا النموذج بعد كل موعد مع طالب
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentAppointment ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-md mb-4">
                <p>
                  <span className="font-semibold">الطالب:</span>{" "}
                  طالب {currentAppointment.studentId}
                </p>
                <p>
                  <span className="font-semibold">الوقت:</span>{" "}
                  {/* Display time without timezone conversion */}
                  {format(new Date(currentAppointment.startTime), "HH:mm")}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    هل تمت متابعة الطالب؟
                  </label>
                  <Textarea
                    value={formData.question1}
                    onChange={(e) =>
                      setFormData({ ...formData, question1: e.target.value })
                    }
                    placeholder="نعم/لا"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    هل استجاب الطالب للمتابعة؟
                  </label>
                  <Textarea
                    value={formData.question2}
                    onChange={(e) =>
                      setFormData({ ...formData, question2: e.target.value })
                    }
                    placeholder="نعم/لا"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    ماذا سمع؟
                  </label>
                  <Textarea
                    value={formData.question3}
                    onChange={(e) =>
                      setFormData({ ...formData, question3: e.target.value })
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
                      setFormData({ ...formData, question4: e.target.value })
                    }
                    placeholder="أي ملاحظات إضافية عن الجلسة"
                    required
                  />
                </div>
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
          ) : (
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
                        appointment.status === "completed" ? "opacity-50" : ""
                      }`}
                      onClick={() => {
                        if (appointment.status !== "completed") {
                          setCurrentAppointment(appointment);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              {/* Display time without timezone conversion */}
                              {format(new Date(appointment.startTime), "HH:mm")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              طالب {appointment.studentId}
                            </p>
                          </div>
                          <Badge
                            variant={
                              appointment.status === "completed"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {appointment.status === "completed"
                              ? "مكتمل"
                              : "بانتظار التقييم"}
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