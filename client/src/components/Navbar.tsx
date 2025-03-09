import * as React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/auth');
      }
    });
  };

  if (!user) return null;

  // Translate role names to Arabic
  const roleInArabic = {
    student: "الطالب",
    teacher: "المعلم",
    manager: "المدير"
  }[user.role] || user.role;

  return (
    <div className="bg-background border-b py-2 px-4 mb-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="font-semibold">
          {`لوحة تحكم ${roleInArabic}`}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "جاري تسجيل الخروج..." : "تسجيل الخروج"}
        </Button>
      </div>
    </div>
  );
}