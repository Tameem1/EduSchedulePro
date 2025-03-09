import * as React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuestionnaireSchema } from "@shared/schema";
import type { QuestionnaireResponse } from "@shared/schema";
import { format } from 'date-fns';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";


const questions = [
  "How was the student's engagement during the session?",
  "What topics were covered in the session?",
  "What areas need improvement?",
  "Any recommendations for future sessions?"
];

const sampleAppointments = [
  { id: 1, studentName: "Alice", time: "2024-03-08T10:00:00", completed: false },
  { id: 2, studentName: "Bob", time: "2024-03-08T11:00:00", completed: true },
  { id: 3, studentName: "Charlie", time: "2024-03-08T12:00:00", completed: false },
];


export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentAppointment, setCurrentAppointment] = React.useState(null);
  const [formData, setFormData] = React.useState({
    question1: "",
    question2: "",
    question3: "",
    question4: "",
    rating: 5
  });

  const form = useForm({
    resolver: zodResolver(insertQuestionnaireSchema),
    defaultValues: {
      studentName: "",
      question1: "",
      question2: "",
      question3: "",
      question4: "",
      appointmentId: 1, // Default value for appointmentId
    },
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire-responses", data);
      return res.json();
    },
    onSuccess: () => {
      // Show toast notification
      toast({
        title: "Questionnaire Submitted",
        description: "Your responses have been recorded successfully.",
        duration: 5000, // Longer duration
      });

      // Set success message for visual feedback
      //setSuccessMessage("Questionnaire submitted successfully!");

      // Reset form
      form.reset({
        studentName: "",
        question1: "",
        question2: "",
        question3: "",
        question4: "",
        appointmentId: 1, // Reset to default
      });
    },
  });

  const handleSubmit = (data: any) => {
    // Add appointmentId if not present
    const formData = {
      ...data,
      appointmentId: data.appointmentId || 1,
    };

    submitQuestionnaireMutation.mutate(formData);
  };

  const handleChange = (name: string, value: any) => {
    setFormData({ ...formData, [name]: value });
  };

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
                <p><span className="font-semibold">الطالب:</span> {currentAppointment.studentName}</p>
                <p><span className="font-semibold">الوقت:</span> {format(new Date(currentAppointment.time), "h:mm a")}</p>
              </div>

              <div>
                <Label htmlFor="question1">على ماذا عملتم؟</Label>
                <Textarea 
                  id="question1"
                  placeholder="وصف المواضيع التي تمت تغطيتها في الجلسة"
                  value={formData.question1}
                  onChange={(e) => handleChange("question1", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="question2">ما الاستراتيجيات التي كانت فعالة؟</Label>
                <Textarea 
                  id="question2"
                  placeholder="ما أساليب التدريس التي بدت مفيدة للطالب؟"
                  value={formData.question2}
                  onChange={(e) => handleChange("question2", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="question3">مجالات التحسين</Label>
                <Textarea 
                  id="question3"
                  placeholder="ما هي المفاهيم التي ما زال الطالب بحاجة للمساعدة فيها؟"
                  value={formData.question3}
                  onChange={(e) => handleChange("question3", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="question4">ملاحظات للجلسة القادمة</Label>
                <Textarea 
                  id="question4"
                  placeholder="ما الذي يجب أن يكون محور تركيز الموعد التالي؟"
                  value={formData.question4}
                  onChange={(e) => handleChange("question4", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="rating">تقييم الجلسة (1-5)</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    id="rating"
                    min={1}
                    max={5}
                    step={0.5}
                    value={[formData.rating]}
                    onValueChange={(value) => handleChange("rating", value[0])}
                  />
                  <span className="w-12 text-center">{formData.rating}</span>
                </div>
              </div>

              <Button type="submit" className="w-full">إرسال التقييم</Button>
            </form>
          ) : (
            <div className="py-8">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium">اختر موعداً</h3>
                <p className="text-muted-foreground">
                  اختر موعداً من اليوم لإكمال الاستبيان
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
                  {sampleAppointments.map((appointment) => (
                    <Card 
                      key={appointment.id} 
                      className="cursor-pointer hover:border-primary"
                      onClick={() => setCurrentAppointment(appointment)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {format(new Date(appointment.time), "h:mm a")}
                        </CardTitle>
                        <CardDescription>الطالب: {appointment.studentName}</CardDescription>
                      </CardHeader>
                      <CardFooter className="pt-2">
                        {appointment.completed ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">مكتمل</Badge>
                        ) : (
                          <Badge variant="outline">قيد الانتظار</Badge>
                        )}
                      </CardFooter>
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