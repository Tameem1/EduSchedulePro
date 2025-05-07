import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { UserRoleType } from "@shared/schema";

export function ProtectedRoute({
  path,
  role,
  component: Component,
}: {
  path: string;
  role: UserRoleType;
  component: () => React.JSX.Element | null;
}) {
  console.log(`ProtectedRoute initialized for path: ${path}, role: ${role}`);
  const { user, isLoading } = useAuth();
  
  React.useEffect(() => {
    console.log(`ProtectedRoute for ${path} mounted`);
    console.log(`Path match check: ${window.location.pathname} === ${path}`);
    console.log(`User authenticated: ${!!user}, User role: ${user?.role}, Expected role: ${role}`);
    
    return () => {
      console.log(`ProtectedRoute for ${path} unmounted`);
    };
  }, [path, role, user]);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user || user.role !== role) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
