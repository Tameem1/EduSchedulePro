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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = React.useState<string>("");

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
  
  // Filter teachers based on search query
  const filteredTeachers = React.useMemo(() => {
    if (!teachers) return [];
    if (!searchQuery.trim()) return teachers;
    
    return teachers.filter(teacher => 
      teacher.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teachers, searchQuery]);

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
  
  const updateAssignmentMutation = useMutation({
    mutationFn: async () => {
      await axios.patch(`/api/appointments/${id}`, {
        teacherAssignment: assignment,
      });
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث المهمة",
        description: "تم تحديث المهمة المطلوبة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في تحديث المهمة",
        description: "لم يتم تحديث المهمة المطلوبة",
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
              <Label htmlFor="teacher-search">بحث عن معلم</Label>
              <div className="flex items-center relative mb-2">
                <Input
                  id="teacher-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اكتب اسم المعلم للبحث"
                  className="pr-8"
                />
                <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
              </div>
              <Label htmlFor="teacher">اختر المعلم</Label>
              <Select
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
              >
                <SelectTrigger id="teacher">
                  <SelectValue placeholder="اختر المعلم" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeachers.length > 0 ? (
                    filteredTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-muted-foreground text-center text-sm">
                      لا يوجد معلمين مطابقين للبحث
                    </div>
                  )}
                </SelectContent>
              </Select>
              {teachers && filteredTeachers.length < teachers.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  تم عرض {filteredTeachers.length} من أصل {teachers.length} معلم
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="assignment">المهمة المطلوبة</Label>
              <div className="flex gap-2">
                <Input
                  id="assignment"
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  placeholder="أدخل المهمة المطلوبة من المعلم"
                />
                <Button 
                  onClick={() => updateAssignmentMutation.mutate()}
                  disabled={updateAssignmentMutation.isPending}
                >
                  {updateAssignmentMutation.isPending ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  ) : (
                    "تغيير"
                  )}
                </Button>
              </div>
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