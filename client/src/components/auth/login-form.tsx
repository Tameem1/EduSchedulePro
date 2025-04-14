
import * as React from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";
import { Loader2 } from "lucide-react";

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
  const [usersInSection, setUsersInSection] = useState<Array<{id: number, username: string}>>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      section: "",
      username: "",
      password: "",
    },
  });

  // Fetch available sections on component mount
  useEffect(() => {
    const fetchSections = async () => {
      setIsLoadingSections(true);
      try {
        console.log("[Login] Fetching available sections");
        const response = await axios.get("/api/sections");
        setSections(response.data);
        console.log("[Login] Fetched sections:", response.data);
      } catch (error) {
        console.error("[Login Error] Failed to fetch sections:", error);
        setSections([]);
      } finally {
        setIsLoadingSections(false);
      }
    };

    fetchSections();
  }, []);

  // When section changes, fetch users for that section
  const handleSectionChange = async (sectionValue: string) => {
    // Reset form fields
    form.setValue("section", sectionValue);
    form.setValue("username", "");
    setUsersInSection([]);
    
    // Validate section field
    await form.trigger("section");
    
    if (!sectionValue) return;
    
    setIsLoadingUsers(true);
    try {
      console.log(`[Login] Fetching users for section: ${sectionValue}`);
      const response = await axios.get(`/api/section/${sectionValue}/students`);
      setUsersInSection(response.data);
      console.log(`[Login] Fetched ${response.data.length} users for section ${sectionValue}`);
    } catch (error) {
      console.error("[Login Error] Failed to fetch users for section:", error);
      setUsersInSection([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Clear error when form values change
  useEffect(() => {
    if (loginError) {
      setLoginError(null);
    }
  }, [form.watch("section"), form.watch("username"), form.watch("password"), loginError]);

  // Handle login error display
  useEffect(() => {
    if (loginMutation.isError) {
      setLoginError(loginMutation.error?.message || "فشل تسجيل الدخول. يرجى التحقق من القسم واسم المستخدم وكلمة المرور.");
    }
  }, [loginMutation.isError, loginMutation.error]);

  // Form submission handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("[Login] Form submitted:", {
      section: values.section,
      username: values.username,
      passwordLength: values.password.length,
    });
    
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
        {/* Section Dropdown */}
        <FormField
          control={form.control}
          name="section"
          render={({ field }) => (
            <FormItem>
              <FormLabel>القسم</FormLabel>
              <FormControl>
                <Select 
                  disabled={isLoadingSections} 
                  onValueChange={handleSectionChange} 
                  value={field.value}
                >
                  <SelectTrigger className="w-full">
                    {isLoadingSections ? (
                      <div className="flex items-center justify-between w-full">
                        <span>جاري تحميل الأقسام...</span>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <SelectValue placeholder="اختر القسم" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {sections.length > 0 ? (
                      sections.map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="empty" disabled>
                        لم يتم العثور على أقسام
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Username Dropdown - Only enabled when section is selected */}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>اسم المستخدم</FormLabel>
              <FormControl>
                <Select
                  disabled={!form.getValues().section || isLoadingUsers}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="w-full">
                    {isLoadingUsers ? (
                      <div className="flex items-center justify-between w-full">
                        <span>جاري تحميل المستخدمين...</span>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <SelectValue placeholder="اختر اسم المستخدم" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {usersInSection.length > 0 ? (
                      usersInSection.map((user) => (
                        <SelectItem key={user.id} value={user.username}>
                          {user.username}
                        </SelectItem>
                      ))
                    ) : form.getValues().section ? (
                      <SelectItem value="empty" disabled>
                        لا يوجد مستخدمين في هذا القسم
                      </SelectItem>
                    ) : (
                      <SelectItem value="select-section" disabled>
                        الرجاء اختيار القسم أولاً
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password Input */}
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
                  placeholder="أدخل كلمة المرور"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Error Display */}
        {loginError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm text-right">
            {loginError}
          </div>
        )}

        {/* Submit Button */}
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
          {loginMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              جاري الدخول...
            </>
          ) : (
            "تسجيل الدخول"
          )}
        </Button>
      </form>
    </Form>
  );
}
