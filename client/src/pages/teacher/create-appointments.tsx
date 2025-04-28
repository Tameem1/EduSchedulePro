import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Link } from "wouter";

export default function TeacherCreateAppointments() {
  const { user } = useAuth();

  // Must be teacher
  if (!user || user.role !== UserRole.TEACHER) {
    return (
      <div className="p-4">
        <p>غير مصرح لك بالوصول لهذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">المواعيد التي أنشأتها</h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/appointments" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">العودة إلى المواعيد</Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>المواعيد التي أنشأتها للطلاب</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-center">سيتم عرض المواعيد التي قمت بإنشائها للطلاب هنا. هذه الصفحة قيد التطوير.</p>
        </CardContent>
      </Card>
    </div>
  );
}