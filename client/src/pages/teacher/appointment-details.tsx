import * as React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Loader2, ArrowLeft, CheckCircle, Clock, XCircle, MessageCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppointmentStatus, AppointmentStatusArabic, type Appointment, type QuestionnaireResponse } from "@shared/schema";

export default function AppointmentDetails() {
  const params = useParams<{ id: string }>();
  const appointmentId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  // Fetch appointment details
  const {
    data: appointment,
    isLoading: loadingAppointment,
    error: appointmentError,
  } = useQuery<Appointment>({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch appointment details");
      }
      return res.json();
    },
    enabled: !!appointmentId && !!user,
  });

  // Fetch questionnaire responses if appointment is done
  const {
    data: questionnaireResponse,
    isLoading: loadingQuestionnaire,
  } = useQuery<QuestionnaireResponse>({
    queryKey: ["/api/appointments", appointmentId, "questionnaire"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}/questionnaire`);
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch questionnaire");
      }
      return res.json();
    },
    enabled: !!appointmentId && !!appointment && appointment.status === AppointmentStatus.DONE,
  });

  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case AppointmentStatus.PENDING:
        return "bg-gray-500";
      case AppointmentStatus.REQUESTED:
        return "bg-blue-500";
      case AppointmentStatus.ASSIGNED:
        return "bg-yellow-500";
      case AppointmentStatus.RESPONDED:
        return "bg-green-500";
      case AppointmentStatus.DONE:
        return "bg-purple-500";
      case AppointmentStatus.REJECTED:
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Auth and loading states
  if (!user) {
    setLocation("/auth");
    return null;
  }

  if (user.role !== "teacher" && user.role !== "manager") {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-xl font-bold">غير مصرح بالوصول</h1>
        <p className="mb-4">ليس لديك الصلاحيات اللازمة لعرض تفاصيل هذا الموعد</p>
        <Button onClick={() => setLocation("/")}>العودة للرئيسية</Button>
      </div>
    );
  }

  if (loadingAppointment || (appointment?.status === AppointmentStatus.DONE && loadingQuestionnaire)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (appointmentError || !appointment) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-xl font-bold">خطأ في تحميل البيانات</h1>
        <p className="mb-4">لم نتمكن من العثور على تفاصيل الموعد</p>
        <Button onClick={() => setLocation("/teacher/appointments")}>العودة للمواعيد</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setLocation("/teacher/appointments")}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          العودة للمواعيد
        </Button>
        
        <Badge className={getStatusColor(appointment.status)}>
          {AppointmentStatusArabic[appointment.status] || appointment.status}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>تفاصيل الموعد</CardTitle>
          <CardDescription>
            معلومات أساسية عن الموعد
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-1">الطالب</h3>
              <p>{appointment.student?.username || `طالب رقم ${appointment.studentId}`}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">وقت الموعد</h3>
              <p>{format(new Date(appointment.startTime), "yyyy-MM-dd HH:mm")}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">المعلم</h3>
              <p>
                {appointment.teacher?.username || (appointment.teacherAssignment
                  ? `مكلف: ${appointment.teacherAssignment}`
                  : "لم يتم تعيين معلم")}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">حالة الموعد</h3>
              <p>{AppointmentStatusArabic[appointment.status] || appointment.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>مسار الموعد</CardTitle>
          <CardDescription>
            تتبع حالة الموعد منذ إنشائه
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`mt-1 p-2 rounded-full ${appointment.status !== AppointmentStatus.PENDING ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <Clock size={18} />
              </div>
              <div>
                <h3 className="font-semibold">تم إنشاء الموعد</h3>
                <p className="text-sm text-gray-500">
                  تم إنشاء موعد للطالب {appointment.student?.username || `رقم ${appointment.studentId}`}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className={`mt-1 p-2 rounded-full ${appointment.status !== AppointmentStatus.PENDING ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold">تم طلب المعلم</h3>
                <p className="text-sm text-gray-500">
                  {appointment.teacherAssignment 
                    ? `تم تحديد المعلم المكلف: ${appointment.teacherAssignment}` 
                    : appointment.teacher 
                      ? `تم تعيين المعلم: ${appointment.teacher.username}` 
                      : "لم يتم تحديد معلم بعد"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className={`mt-1 p-2 rounded-full ${appointment.status === AppointmentStatus.ASSIGNED || appointment.status === AppointmentStatus.RESPONDED || appointment.status === AppointmentStatus.DONE ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <CheckCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold">قبول المعلم</h3>
                <p className="text-sm text-gray-500">
                  {appointment.status === AppointmentStatus.ASSIGNED || 
                   appointment.status === AppointmentStatus.RESPONDED || 
                   appointment.status === AppointmentStatus.DONE
                    ? "قام المعلم بقبول الموعد"
                    : appointment.status === AppointmentStatus.REJECTED
                      ? "تم رفض الموعد من قبل المعلم"
                      : "لم يتم قبول الموعد بعد"
                  }
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className={`mt-1 p-2 rounded-full ${appointment.status === AppointmentStatus.RESPONDED || appointment.status === AppointmentStatus.DONE ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold">استجابة الطالب</h3>
                <p className="text-sm text-gray-500">
                  {appointment.status === AppointmentStatus.RESPONDED || appointment.status === AppointmentStatus.DONE
                    ? "استجاب الطالب للمتابعة"
                    : "لم يستجب الطالب بعد"
                  }
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <div className={`mt-1 p-2 rounded-full ${appointment.status === AppointmentStatus.DONE ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <CheckCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold">إكمال الموعد</h3>
                <p className="text-sm text-gray-500">
                  {appointment.status === AppointmentStatus.DONE
                    ? "تم إكمال الموعد بنجاح"
                    : "لم يتم إكمال الموعد بعد"
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {appointment.status === AppointmentStatus.DONE && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج المتابعة</CardTitle>
            <CardDescription>
              تفاصيل ما تم في الموعد والاستبيان
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionnaireResponse ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">هل تمت متابعة الطالب؟</h3>
                  <p>{questionnaireResponse.question1 === "نعم" ? "نعم" : "لا"}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">هل استجاب الطالب للمتابعة؟</h3>
                  <p>{questionnaireResponse.question2 === "نعم" ? "نعم" : "لا"}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">ماذا سمّع الطالب؟</h3>
                  <p>{questionnaireResponse.question3 || "لا يوجد"}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">ملاحظات إضافية</h3>
                  <p>{questionnaireResponse.question4 || "لا يوجد ملاحظات"}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p>لم يتم العثور على استبيان مكتمل لهذا الموعد</p>
                <Button 
                  className="mt-4"
                  onClick={() => setLocation(`/teacher/questionnaire/${appointmentId}`)}
                >
                  إكمال الاستبيان
                </Button>
              </div>
            )}
          </CardContent>
        </CardFooter>
      )}

      {appointment.status === AppointmentStatus.ASSIGNED && (
        <div className="flex justify-center mt-6">
          <Button 
            onClick={() => setLocation(`/teacher/questionnaire/${appointmentId}`)}
          >
            إدخال نتائج المتابعة
          </Button>
        </div>
      )}
    </div>
  );
}