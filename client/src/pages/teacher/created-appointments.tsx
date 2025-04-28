import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TeacherCreatedAppointments() {
  const { user } = useAuth();

  // Debug log to track component mounting
  React.useEffect(() => {
    console.log("TeacherCreatedAppointments component mounted");
    console.log("Current user:", user);
    
    return () => {
      console.log("TeacherCreatedAppointments component unmounted");
    };
  }, [user]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">
          المواعيد التي أنشأتها
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => {
              console.log("Navigating back to appointments");
              window.location.href = "/teacher/appointments";
            }}
          >
            العودة إلى المواعيد
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">صفحة المواعيد التي أنشأتها</p>
          <p className="mt-2">هذه الصفحة قيد التطوير</p>
        </CardContent>
      </Card>
    </div>
  );
}