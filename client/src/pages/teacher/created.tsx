import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

export default function TeacherCreated() {
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
      <h1 className="text-xl md:text-2xl font-bold text-center mb-6">صفحة جديدة للاختبار</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">هذه صفحة اختبار للتأكد من عمل نظام التوجيه.</p>
        </CardContent>
      </Card>
    </div>
  );
}