
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

export function LoginForm() {
  const { loginMutation } = useAuth();
  const [sections, setSections] = useState<string[]>([]);
  const [sectionUsers, setSectionUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

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
      setIsLoadingSections(true);
      try {
        console.log("[Login Debug] Fetching sections");
        const response = await axios.get("/api/sections");
        setSections(response.data);
        console.log("[Login Debug] Fetched sections:", response.data);
      } catch (error) {
        console.error("[Login Error] Failed to fetch sections:", error);
      } finally {
        setIsLoadingSections(false);
      }
    };

    fetchSections();
  }, []);

  // Fetch users when section changes
  const handleSectionChange = async (section: string) => {
    console.log("[Login Debug] Section selected:", section);
    
    // Set the section value in the form
    form.setValue("section", section);
    // Reset username when section changes
    form.setValue("username", "");
    
    // Trigger validation for the section field
    await form.trigger("section");
    
    setIsLoadingUsers(true);
    try {
      console.log(`[Login Debug] Fetching users for section: ${section}`);
      const response = await axios.get(`/api/section/${section}/students`);
      setSectionUsers(response.data);
      console.log(`[Login Debug] Fetched ${response.data.length} users for section ${section}`);
    } catch (error) {
      console.error("[Login Error] Failed to fetch users for section:", error);
      setSectionUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Reset login error when form values change
  useEffect(() => {
    if (loginError) {
      setLoginError(null);
    }
  }, [form.watch("section"), form.watch("username"), form.watch("password"), loginError]);

  // Handle login mutation errors
  useEffect(() => {
    if (loginMutation.isError) {
      setLoginError(loginMutation.error?.message || "فشل تسجيل الدخول. يرجى التحقق من القسم واسم المستخدم وكلمة المرور.");
    }
  }, [loginMutation.isError, loginMutation.error]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("[Auth Debug] Login form submitted with values:", {
      username: values.username,
      section: values.section,
      passwordLength: values.password.length,
    });
    
    // Clear any previous errors
    setLoginError(null);
    
    loginMutation.mutate({
      username: values.username,
      password: values.password,
      section: values.section,
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
              {isLoadingSections ? (
                <FormControl>
                  <Input
                    dir="rtl"
                    placeholder="جاري تحميل الأقسام..."
                    disabled={true}
                  />
                </FormControl>
              ) : (
                <Select onValueChange={handleSectionChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sections.length > 0 ? (
                      sections.map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="loading" disabled>
                        لم يتم العثور على أقسام
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
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
              {isLoadingUsers ? (
                <FormControl>
                  <Input
                    dir="rtl"
                    placeholder="جاري التحميل..."
                    disabled={true}
                  />
                </FormControl>
              ) : sectionUsers.length > 0 ? (
                <Select
                  onValueChange={(value) => {
                    console.log("[Login Debug] Username selected:", value);
                    field.onChange(value);
                  }}
                  value={field.value}
                  disabled={!form.getValues().section}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر اسم المستخدم" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sectionUsers.map((user) => (
                      <SelectItem key={user.id} value={user.username}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <FormControl>
                    <Input
                      dir="rtl"
                      placeholder="ادخل اسم المستخدم"
                      {...field}
                      disabled={!form.getValues().section}
                      onChange={(e) => {
                        console.log("[Login Debug] Username input:", e.target.value);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  {form.getValues().section && (
                    <p className="text-xs text-muted-foreground mt-1">
                      لا يوجد مستخدمين مسجلين في هذا القسم. يمكنك إدخال اسم المستخدم يدويًا.
                    </p>
                  )}
                </>
              )}
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

        {loginError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm text-right">
            {loginError}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            loginMutation.isPending ||
            isLoadingSections ||
            isLoadingUsers ||
            !form.getValues().section ||
            !form.getValues().username ||
            !form.getValues().password
          }
        >
          {loginMutation.isPending ? "جاري الدخول..." : "تسجيل الدخول"}
        </Button>
      </form>
    </Form>
  );
}
