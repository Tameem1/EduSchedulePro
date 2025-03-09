
import * as React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuestionnaireSchema } from "@shared/schema";
import type { QuestionnaireResponse } from "@shared/schema";

const questions = [
  "How was the student's engagement during the session?",
  "What topics were covered in the session?",
  "What areas need improvement?",
  "Any recommendations for future sessions?"
];

export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

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
      setSuccessMessage("Questionnaire submitted successfully!");
      
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

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Post-Session Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {successMessage}
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="studentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student Name</FormLabel>
                    <input
                      {...field}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      placeholder="Enter student name"
                    />
                  </FormItem>
                )}
              />
              
              {questions.map((question, index) => (
                <FormField
                  key={index}
                  control={form.control}
                  name={`question${index + 1}` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{question}</FormLabel>
                      <Textarea {...field} className="min-h-[100px]" />
                    </FormItem>
                  )}
                />
              ))}
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={submitQuestionnaireMutation.isPending}
              >
                Submit Responses
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
