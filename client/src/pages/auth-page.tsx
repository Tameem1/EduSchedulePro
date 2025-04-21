import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect, useLocation } from "wouter";
import { insertUserSchema, UserRole, type UserRoleType, Section } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";

const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
});

const registerSchema = insertUserSchema.extend({
  telegramUsername: z.string().optional(), // Changed to telegramUsername
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch available sections
  const { data: sections } = useQuery<string[], Error>({
    queryKey: ["/api/sections"],
    queryFn: getQueryFn({ on401: "throw" })
  });

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      section: "aasem", // Default section
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      role: UserRole.STUDENT as UserRoleType,
      telegramUsername: "", // Changed to telegramUsername
      section: "aasem", // Default section
    },
  });

  if (user) {
    const roleRedirects: Record<UserRoleType, string> = {
      [UserRole.STUDENT]: "/student/book-appointment",
      [UserRole.TEACHER]: "/teacher/availability",
      [UserRole.MANAGER]: "/manager/appointments",
    };
    return <Redirect to={roleRedirects[user.role]} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-4xl w-full px-4 flex gap-8">
        <div className="flex-1">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="login">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">
                    تسجيل الدخول
                  </TabsTrigger>
                  <TabsTrigger value="register" className="flex-1">
                    تسجيل جديد
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="bg-green-50 p-3 mb-4 rounded-md border border-green-200">
                    <p className="text-sm text-green-800">
                      ستبقى مسجل الدخول حتى بعد إغلاق المتصفح
                    </p>
                  </div>
                  <form
                    onSubmit={loginForm.handleSubmit((data) =>
                      loginMutation.mutate(data),
                    )}
                  >
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">اسم المستخدم</Label>
                        <Input {...loginForm.register("username")} />
                      </div>
                      <div>
                        <Label htmlFor="password">كلمة المرور</Label>
                        <Input
                          type="password"
                          {...loginForm.register("password")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="section">القسم</Label>
                        <Select
                          onValueChange={(value) => loginForm.setValue("section", value)}
                          defaultValue={loginForm.getValues("section")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر القسم" />
                          </SelectTrigger>
                          <SelectContent>
                            {sections?.map((section) => (
                              <SelectItem key={section} value={section}>
                                {section}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending
                          ? "جاري تسجيل الدخول..."
                          : "تسجيل الدخول"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <div className="bg-blue-50 p-3 mb-4 rounded-md border border-blue-200">
                    <p className="text-sm text-blue-800">
                      يمكنك إضافة معرف تيليجرام الخاص بك لتلقي الإشعارات
                      المتعلقة بالمواعيد والتحديثات عبر تيليجرام
                    </p>
                  </div>
                  <form
                    onSubmit={registerForm.handleSubmit((data) =>
                      registerMutation.mutate(data),
                    )}
                  >
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">اسم المستخدم</Label>
                        <Input {...registerForm.register("username")} />
                      </div>
                      <div>
                        <Label htmlFor="password">كلمة المرور</Label>
                        <Input
                          type="password"
                          {...registerForm.register("password")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">نوع الحساب</Label>
                        <Select
                          onValueChange={(value) =>
                            registerForm.setValue("role", value as UserRoleType)
                          }
                          defaultValue={registerForm.getValues("role")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر نوع الحساب" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UserRole.STUDENT}>
                              طالب
                            </SelectItem>
                            <SelectItem value={UserRole.TEACHER}>
                              معلم
                            </SelectItem>
                            <SelectItem value={UserRole.MANAGER}>
                              مدير
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="section">القسم</Label>
                        <Select
                          onValueChange={(value) => registerForm.setValue("section", value)}
                          defaultValue={registerForm.getValues("section")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر القسم" />
                          </SelectTrigger>
                          <SelectContent>
                            {sections?.map((section) => (
                              <SelectItem key={section} value={section}>
                                {section}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="telegramUsername">
                          معرف تيليجرام (اختياري)
                        </Label>{" "}
                        {/* Changed label */}
                        <Input
                          dir="ltr"
                          type="text"
                          placeholder="@username"
                          {...registerForm.register("telegramUsername")}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending
                          ? "جاري إنشاء الحساب..."
                          : "إنشاء حساب"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 hidden lg:block">
          <div className="h-full flex flex-col justify-center">
            <h1 className="text-4xl font-bold mb-4">نظام حجز المواعيد</h1>
            <p className="text-lg text-gray-600">
              مرحباً بك في نظام حجز المواعيد. قم بتسجيل الدخول أو إنشاء حساب
              جديد لـ:
            </p>
            <ul className="mt-4 space-y-2 text-gray-600">
              <li>• حجز المواعيد كطالب</li>
              <li>• إدارة جدولك كمعلم</li>
              <li>• الإشراف على جميع المواعيد كمدير</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}