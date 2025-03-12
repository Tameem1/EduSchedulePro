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
import { formatGMT3Time } from "@/lib/date-utils";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentStatusType } from "@shared/schema";
import { AppointmentStatus, AppointmentStatusArabic } from "@shared/schema";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";

export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentAppointment, setCurrentAppointment] = React.useState<Appointment | null>(null);
  const [formData, setFormData] = React.useState({
    question1: false,
    question2: false,
    question3: "",
    question4: "",
  });
  const socketRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'appointmentUpdate') {
        queryClient.invalidateQueries({
          queryKey: ["/api/teachers", user?.id, "appointments"]
        });
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user?.id]);

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

  // Helper function to get student name
  const getStudentName = (studentId: number) => {
    const student = students?.find(s => s.id === studentId);
    return student?.username || `طالب ${studentId}`;
  };

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST",
        "/api/questionnaire-responses",
        {
          ...data,
          appointmentId: currentAppointment?.id,
          question1: data.question1 ? "نعم" : "لا",
          question2: data.question2 ? "نعم" : "لا",
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

      setFormData({
        question1: false,
        question2: false,
        question3: "",
        question4: "",
      });
      setCurrentAppointment(null);

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

  const getStatusColor = (status: AppointmentStatusType) => {
    return {
      [AppointmentStatus.PENDING]: "bg-gray-500",
      [AppointmentStatus.REQUESTED]: "bg-blue-500",
      [AppointmentStatus.ASSIGNED]: "bg-yellow-500",
      [AppointmentStatus.RESPONDED]: "bg-green-500",
      [AppointmentStatus.DONE]: "bg-purple-500",
    }[status] || "bg-gray-500";
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
                  {getStudentName(currentAppointment.studentId)}
                </p>
                <p>
                  <span className="font-semibold">الوقت:</span>{" "}
                  {new Date(currentAppointment.startTime).toLocaleString('ar-SA', {
                    timeZone: 'Asia/Riyadh',
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  })}
                </p>
                <Badge className={`${getStatusColor(currentAppointment.status as AppointmentStatusType)} text-white`}>
                  {AppointmentStatusArabic[currentAppointment.status as AppointmentStatusType]}
                </Badge>
              </div>

              {currentAppointment.status === AppointmentStatus.REQUESTED && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    يجب قبول الموعد أولاً قبل إكمال الاستبيان
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setLocation(`/teacher/accept-appointment/${currentAppointment.id}`)}
                  >
                    قبول الموعد
                  </Button>
                </div>
              )}

              {currentAppointment.status === AppointmentStatus.ASSIGNED && (
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
                      onCheckedChange={(checked) => {
                        setFormData({ ...formData, question2: checked });
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
              )}
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
                        appointment.status === AppointmentStatus.DONE ? "opacity-50" : ""
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
                            <p className="font-medium">
                              {new Date(appointment.startTime).toLocaleString('ar-SA', {
                                timeZone: 'Asia/Riyadh',
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: 'numeric',
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getStudentName(appointment.studentId)}
                            </p>
                          </div>
                          <Badge
                            className={`${getStatusColor(appointment.status as AppointmentStatusType)} text-white`}
                          >
                            {AppointmentStatusArabic[appointment.status as AppointmentStatusType]}
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