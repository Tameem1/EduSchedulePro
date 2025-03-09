import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuestionnaireSchema } from "@shared/schema";
import { Link } from "wouter";

const questions = [
  "How was the student's engagement during the session?",
  "What topics were covered in the session?",
  "What areas need improvement?",
  "Any recommendations for future sessions?"
];

export default function TeacherQuestionnaire() {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertQuestionnaireSchema),
    defaultValues: {
      question1: "",
      question2: "",
      question3: "",
      question4: "",
    },
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire-responses", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Questionnaire Submitted",
        description: "Your responses have been recorded.",
      });
      form.reset();
    },
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Session Questionnaire</h1>
        <Link href="/teacher/availability">
          <Button variant="outline">Back to Availability</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post-Session Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => submitQuestionnaireMutation.mutate(data))} className="space-y-6">
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
