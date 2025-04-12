
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@shared/schema";

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
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  section: z.string({
    required_error: "يرجى اختيار القسم",
  }),
  username: z.string().min(1, "يرجى اختيار اسم المستخدم"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

// Convert section keys to Arabic names
const sectionNames = {
  aasem: "عاصم",
  khaled: "خالد",
  mmdoh: "ممدوح",
  obada: "عبادة",
  awab: "أواب",
  zuhair: "زهير",
  yahia: "يحيى",
  omar: "عمر",
  motaa: "مطاع",
  mahmoud: "محمود",
};

export function LoginForm() {
  const { loginMutation } = useAuth();
  const [selectedSection, setSelectedSection] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      section: "",
      username: "",
      password: "",
    },
  });

  // Get users by section
  const { data: usersBySection } = useQuery({
    queryKey: ['users-by-section', selectedSection],
    queryFn: async () => {
      if (!selectedSection) return [];
      const response = await apiRequest("GET", `/api/users/by-section/${selectedSection}`);
      return response.json();
    },
    enabled: !!selectedSection,
  });

  // When section changes, reset username field
  React.useEffect(() => {
    if (selectedSection) {
      form.setValue('section', selectedSection);
      form.setValue('username', '');
    }
  }, [selectedSection, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate({
      username: values.username,
      password: values.password,
      section: values.section,
    });
  }

  // Get all available sections
  const sections = Object.keys(Section) as Array<keyof typeof Section>;

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
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedSection(value);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent dir="rtl">
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {sectionNames[section as keyof typeof sectionNames] || section}
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
                disabled={!selectedSection}
              >
                <FormControl>
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر اسم المستخدم" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent dir="rtl">
                  {usersBySection && usersBySection.map((user: any) => (
                    <SelectItem key={user.id} value={user.username}>
                      {user.username}
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
