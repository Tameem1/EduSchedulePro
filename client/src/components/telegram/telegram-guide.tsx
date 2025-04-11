import React from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const telegramFormSchema = z.object({
  telegramUsername: z.string().min(1, "الرجاء إدخال معرف تيليجرام"),
});

export function TelegramGuide() {
  const [open, setOpen] = React.useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof telegramFormSchema>>({
    resolver: zodResolver(telegramFormSchema),
    defaultValues: {
      telegramUsername: "",
    },
  });

  const updateTelegramUsername = async (values: z.infer<typeof telegramFormSchema>) => {
    try {
      if (!user) return;
      
      const res = await apiRequest(
        "PATCH",
        `/api/users/${user.id}`,
        { telegramUsername: values.telegramUsername }
      );
      
      if (!res.ok) {
        throw new Error("فشل تحديث معرف تيليجرام");
      }
      
      toast({
        title: "تم تحديث معرف تيليجرام بنجاح",
        description: "ستصلك إشعارات المواعيد الآن عبر تيليجرام",
      });
      
      // Update the local user data by invalidating the auth query
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      setOpen(false);
    } catch (error) {
      toast({
        title: "حدث خطأ",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء تحديث معرف تيليجرام",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Alert className="mb-6 border-yellow-500 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">لم يتم ربط حسابك بتيليجرام</AlertTitle>
        <AlertDescription className="text-yellow-700">
          لتلقي إشعارات المواعيد والرسائل المهمة، يجب عليك ربط حسابك بتيليجرام.{" "}
          <DialogTrigger asChild>
            <Button variant="link" className="p-0 h-auto text-yellow-600">
              إضغط هنا لإعداد التيليجرام
            </Button>
          </DialogTrigger>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">ربط حسابك بتيليجرام</DialogTitle>
            <DialogDescription>
              أتبع الخطوات التالية لربط حسابك بتيليجرام وتلقي الإشعارات
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="text-primary h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-primary/10">1</div>
                <div>
                  <h3 className="font-medium">افتح تطبيق تيليجرام</h3>
                  <p className="text-sm text-muted-foreground">
                    افتح تطبيق تيليجرام على هاتفك أو جهاز الكمبيوتر
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="text-primary h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-primary/10">2</div>
                <div>
                  <h3 className="font-medium">ابحث عن الروبوت</h3>
                  <p className="text-sm text-muted-foreground">
                    ابحث عن روبوت المنصة <span className="font-bold">Abo01_bot@</span> أو اضغط{" "}
                    <a 
                      href="https://t.me/Abo01_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      هنا
                    </a>
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="text-primary h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-primary/10">3</div>
                <div>
                  <h3 className="font-medium">ابدأ محادثة مع الروبوت</h3>
                  <p className="text-sm text-muted-foreground">
                    اضغط على زر "ابدأ" أو أرسل أي رسالة للروبوت
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="text-primary h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-primary/10">4</div>
                <div>
                  <h3 className="font-medium">أدخل معرف تيليجرام</h3>
                  <p className="text-sm text-muted-foreground">
                    أدخل معرف المستخدم الخاص بك في تيليجرام (مثال: username@) أو رقم الهاتف المرتبط بحسابك في تيليجرام
                  </p>
                </div>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(updateTelegramUsername)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="telegramUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>معرف تيليجرام</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="@username أو رقم هاتفك" 
                          {...field} 
                          dir="ltr"
                        />
                      </FormControl>
                      <FormDescription>
                        أدخل معرف المستخدم الخاص بك في تيليجرام مثل username@ أو رقم هاتفك المرتبط بتيليجرام
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}