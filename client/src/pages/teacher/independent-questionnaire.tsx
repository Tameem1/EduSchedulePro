import * as React from "react";
import { useLocation } from "wouter";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

import {
  User,
  UserRole,
} from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";

// Create form schema
const formSchema = z.object({
  section: z.string().min(1, { message: "الرجاء اختيار الفصل" }),
  studentId: z.string().min(1, { message: "الرجاء اختيار الطالب" }),
  date: z.string().min(1, { message: "الرجاء اختيار التاريخ" }),
  question1: z.boolean().default(false),
  question2: z.boolean().default(false),
  question3: z.string().min(1, { message: "الرجاء إدخال ما تم سماعه" }),
  question4: z.string().min(1, { message: "الرجاء إدخال ملاحظات الجلسة" }),
});

const TeacherIndependentQuestionnaire = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filteredStudents, setFilteredStudents] = React.useState<User[]>([]);

  // Create form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      section: "",
      studentId: "",
      date: "",
      question1: false,
      question2: false,
      question3: "",
      question4: "",
    },
  });

  // Fetch sections
  const { data: sections, isLoading: loadingSections } = useQuery<string[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sections");
      if (!res.ok) {
        throw new Error("Failed to fetch sections");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Function to fetch students for the selected section
  const fetchStudentsBySection = async (section: string) => {
    try {
      if (!section) {
        setFilteredStudents([]);
        form.setValue("studentId", "");
        return;
      }
      
      const res = await apiRequest("GET", `/api/section/${section}/students`);
      if (!res.ok) {
        throw new Error(`Failed to fetch students for section ${section}`);
      }
      
      const sectionStudents = await res.json();
      console.log(`Fetched ${sectionStudents.length} students for section ${section}`);
      setFilteredStudents(sectionStudents);
      form.setValue("studentId", "");
    } catch (error) {
      console.error("Error fetching students by section:", error);
      toast({
        title: "خطأ في جلب بيانات الطلاب",
        description: "حدث خطأ أثناء محاولة جلب بيانات الطلاب للقسم المختار",
        variant: "destructive",
      });
    }
  };

  // Watch for section changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "section" && value.section) {
        fetchStudentsBySection(value.section);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Handle form submission
  const submitIndependentQuestionnaireMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convert date string to a date object
      const localDate = new Date(data.date);
      
      const res = await apiRequest("POST", "/api/independent-questionnaire", {
        studentId: parseInt(data.studentId),
        date: localDate.toISOString(),
        question1: data.question1 ? "نعم" : "لا",
        question2: data.question2 ? "نعم" : "لا",
        question3: data.question3,
        question4: data.question4
      });
      
      if (!res.ok) {
        let errorMessage = "Failed to submit questionnaire";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      try {
        return await res.json();
      } catch (e) {
        console.log("Response was OK but couldn't parse JSON. Treating as success.");
        return { success: true };
      }
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال التقييم",
        description: "تم حفظ إجاباتك بنجاح",
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

  function onSubmit(values: z.infer<typeof formSchema>) {
    submitIndependentQuestionnaireMutation.mutate(values);
  }

  // Loading states and authorization checks
  if (!user) {
    setLocation("/auth");
    return null;
  }

  if (user.role !== UserRole.TEACHER) {
    return (
      <div className="p-4">
        <p>ليس لديك الصلاحية لدخول هذه الصفحة (تحتاج حساب معلم)</p>
      </div>
    );
  }

  if (loadingSections) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
          <CardTitle>استبيان متابعة مستقل</CardTitle>
          <CardDescription>
            يمكنك استخدام هذا النموذج لإدخال تقييم لطالب بدون الحاجة لموعد مسبق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اختر الفصل</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفصل" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sections?.map((section) => (
                          <SelectItem key={section} value={section}>
                            {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اختر الطالب</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={filteredStudents.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={filteredStudents.length === 0 ? "اختر الفصل أولاً" : "اختر الطالب"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredStudents.map((student) => (
                          <SelectItem key={student.id} value={String(student.id)}>
                            {student.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ ووقت المتابعة</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="question1"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        هل تمت متابعة الطالب؟
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="question2"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        هل استجاب الطالب للمتابعة؟
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="question3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ماذا سمع؟</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="مثال: سورة الإسراء..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="question4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات الجلسة</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أي ملاحظات إضافية عن الجلسة"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={submitIndependentQuestionnaireMutation.isPending}
              >
                {submitIndependentQuestionnaireMutation.isPending
                  ? "جاري الإرسال..."
                  : "إرسال التقييم"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherIndependentQuestionnaire;