import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function TelegramGuide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [telegramUsername, setTelegramUsername] = useState<string>('');

  const updateUserMutation = useMutation({
    mutationFn: async (username: string) => {
      if (!user) throw new Error("User not authenticated");
      
      const res = await apiRequest(
        "PATCH",
        `/api/users/${user.id}`,
        { telegramUsername: username }
      );
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update Telegram username");
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث معلومات تيليجرام",
        description: "تم تحديث اسم المستخدم الخاص بك على تيليجرام بنجاح.",
      });
      
      // Invalidate cached user data to reflect the changes
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error) => {
      toast({
        title: "خطأ في تحديث معلومات تيليجرام",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!telegramUsername.trim()) {
      toast({
        title: "اسم المستخدم مطلوب",
        description: "يرجى إدخال اسم المستخدم الخاص بك على تيليجرام.",
        variant: "destructive",
      });
      return;
    }
    
    // Remove @ symbol if user included it
    const formattedUsername = telegramUsername.startsWith('@') 
      ? telegramUsername.substring(1) 
      : telegramUsername;
      
    updateUserMutation.mutate(formattedUsername);
  };

  return (
    <Card className="mb-8 border-blue-200 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-blue-700">إعداد إشعارات تيليجرام</CardTitle>
        <CardDescription className="text-blue-600">
          يجب عليك ربط حسابك بتيليجرام لتلقي إشعارات عن المواعيد الجديدة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">كيفية الاتصال بتيليجرام:</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>قم بتنزيل تطبيق تيليجرام على الهاتف أو استخدم نسخة الويب <a href="https://web.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">web.telegram.org</a></li>
              <li>ابحث عن روبوت المدرسة على تيليجرام (يمكنك الحصول على المعرف من إدارة المدرسة)</li>
              <li>اضغط على زر "ابدأ" أو أرسل الرسالة /start ثم أرسل /register للحصول على معرف تيليجرام الخاص بك</li>
              <li>أدخل اسم المستخدم الخاص بك في تيليجرام في الحقل أدناه (بدون علامة @)</li>
            </ol>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="telegramUsername" className="font-medium">اسم المستخدم في تيليجرام:</label>
              <div className="flex gap-2">
                <Input
                  id="telegramUsername"
                  placeholder="username"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={updateUserMutation.isPending || !telegramUsername.trim()}
                >
                  {updateUserMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">أدخل اسم المستخدم الخاص بك في تيليجرام (بدون علامة @)</p>
            </div>
          </form>

          <div className="bg-blue-100 p-3 rounded-md text-blue-800 text-sm">
            <p className="font-medium">ملاحظة هامة:</p>
            <p>يجب أن تكون متصلاً بتيليجرام لتتمكن من استلام إشعارات عن المواعيد المخصصة لك. سيتم إخطارك عند تعيين موعد جديد.</p>
            <p className="mt-2">إذا واجهت أي مشكلة في الاتصال بروبوت تيليجرام، يرجى التواصل مع مدير النظام للحصول على المساعدة وتفاصيل الروبوت الصحيحة.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}