
import * as React from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  section: z.string().min(1, "القسم مطلوب"),
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

// The section names are already in Arabic as stored in the database
// so we can use them directly without translation

export function LoginForm() {
  const { loginMutation } = useAuth();
  const [sections, setSections] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      section: "",
      username: "",
      password: "",
    },
  });

  // Fetch sections when component mounts
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await axios.get("/api/sections");
        setSections(response.data);
      } catch (error) {
        console.error("Failed to fetch sections:", error);
      }
    };

    fetchSections();
  }, []);

  // Fetch students when section changes
  const handleSectionChange = async (section: string) => {
    form.setValue("section", section);
    form.setValue("username", ""); // Reset username when section changes
    
    setIsLoadingStudents(true);
    try {
      const response = await axios.get(`/api/section/${section}/students`);
      setStudents(response.data);
    } catch (error) {
      console.error("Failed to fetch students for section:", error);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate({
      username: values.username,
      password: values.password,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="section"
          render={({ field }) => (
            <FormItem>
              <FormLabel>القسم</FormLabel>
              <Select
                onValueChange={handleSectionChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sections.map((section) => (
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
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم المستخدم</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!form.getValues().section || isLoadingStudents}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingStudents ? "جاري التحميل..." : "اختر اسم المستخدم"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.username}>
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>كلمة المرور</FormLabel>
              <FormControl>
                <Input
                  dir="rtl"
                  type="password"
                  placeholder="كلمة المرور"
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
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "جاري الدخول..." : "تسجيل الدخول"}
        </Button>
      </form>
    </Form>
  );
}
