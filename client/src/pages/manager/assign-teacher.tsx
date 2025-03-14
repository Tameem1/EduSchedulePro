import * as React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input"; // Added import statement
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import axios from "axios";

interface Teacher {
  id: number;
  name: string;
}

interface AppointmentDetails {
  id: number;
  title: string;
  studentName: string;
  status: string;
  day: string;
  time: string;
  teacherId: number | null;
  teacherAssignment?: string;
}

export default function AssignTeacher() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedTeacher, setSelectedTeacher] = React.useState<string>("");
  const [assignment, setAssignment] = React.useState<string>("");

  const { data: appointment, isLoading: appointmentLoading } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const response = await axios.get(`/api/appointments/${id}`);
      return response.data as AppointmentDetails;
    },
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const response = await axios.get("/api/teachers");
      return response.data as Teacher[];
    },
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      await axios.post(`/api/appointments/${id}/assign-teacher`, {
        teacherId: parseInt(teacherId),
        teacherAssignment: assignment,
      });
    },
    onSuccess: () => {
      toast({
        title: "تم تعيين المعلم بنجاح",
        description: "تم تعيين المعلم للموعد بنجاح",
      });
      navigate("/manager/appointments");
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "لم يتم تعيين المعلم للموعد",
        variant: "destructive",
      });
    },
  });

  React.useEffect(() => {
    if (appointment?.teacherAssignment) {
      setAssignment(appointment.teacherAssignment);
    }
  }, [appointment]);

  const handleAssignTeacher = () => {
    if (!selectedTeacher) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار معلم",
        variant: "destructive",
      });
      return;
    }
    assignTeacherMutation.mutate(selectedTeacher);
  };

  if (appointmentLoading || teachersLoading) {
    return <div>جاري التحميل...</div>;
  }

  if (!appointment) {
    return <div>لم يتم العثور على الموعد</div>;
  }

  return (
    <div className="container p-4">
      <Button
        variant="outline"
        className="mb-4"
        onClick={() => navigate("/manager/appointments")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> العودة
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>تعيين معلم للموعد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">تفاصيل الموعد</h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="font-medium">العنوان:</span>{" "}
                  {appointment.title}
                </div>
                <div>
                  <span className="font-medium">الطالب:</span>{" "}
                  {appointment.studentName}
                </div>
                <div>
                  <span className="font-medium">اليوم:</span> {appointment.day}
                </div>
                <div>
                  <span className="font-medium">الوقت:</span> {appointment.time}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="teacher">اختر المعلم</Label>
              <Select
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
              >
                <SelectTrigger id="teacher">
                  <SelectValue placeholder="اختر المعلم" />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assignment">المهمة المطلوبة</Label>
              <Input
                id="assignment"
                value={assignment}
                onChange={(e) => setAssignment(e.target.value)}
                placeholder="أدخل المهمة المطلوبة من المعلم"
              />
            </div>
            <Button
              onClick={handleAssignTeacher}
              disabled={assignTeacherMutation.isPending}
            >
              {assignTeacherMutation.isPending
                ? "جاري التعيين..."
                : "تعيين المعلم"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}