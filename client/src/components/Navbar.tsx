
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

  return (
    <div className="bg-background border-b py-2 px-4 mb-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="font-semibold">
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
