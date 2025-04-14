import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import {
  insertUserSchema,
  User as SelectUser,
  InsertUser,
} from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null; // Will never be undefined due to initialData: null
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password"> & { section: string };

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Add debug logging for auth state changes
  useEffect(() => {
    console.log("[Auth Debug] AuthProvider mounted");
    return () => console.log("[Auth Debug] AuthProvider unmounted");
  }, []);

  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      console.log("[Auth Debug] Fetching user data");
      const res = await apiRequest("GET", "/api/user");
      if (res.status === 401) {
        console.log("[Auth Debug] User not authenticated");
        return null;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }
      const userData = await res.json();
      console.log("[Auth Debug] User data fetched:", userData);
      return userData as SelectUser; // Ensure correct type casting
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    initialData: null, // Explicitly set initial data to null
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("[Auth Debug] Attempting login");
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log("[Auth Debug] Login successful:", user);
      queryClient.setQueryData(["/api/user"], user);
      // Redirect based on user role
      switch (user.role) {
        case "teacher":
          setLocation("/teacher/appointments");
          break;
        case "student":
          setLocation("/student/book-appointment");
          break;
        case "manager":
          setLocation("/manager/appointments");
          break;
        default:
          setLocation("/");
      }
    },
    onError: (error: Error) => {
      console.error("[Auth Debug] Login failed:", error);
      toast({
        title: "تسجيل الدخول فشل",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log("[Auth Debug] Attempting registration");
      const res = await apiRequest("POST", "/api/register", credentials);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Registration failed");
      }
      return res.json();
    },
    onSuccess: (user: SelectUser) => {
      console.log("[Auth Debug] Registration successful:", user);
      queryClient.setQueryData(["/api/user"], user);
      // Redirect based on user role after registration
      switch (user.role) {
        case "teacher":
          setLocation("/teacher/appointments");
          break;
        case "student":
          setLocation("/student/book-appointment");
          break;
        case "manager":
          setLocation("/manager/appointments");
          break;
        default:
          setLocation("/");
      }
    },
    onError: (error: Error) => {
      console.error("[Auth Debug] Registration failed:", error);
      toast({
        title: "التسجيل فشل",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("[Auth Debug] Attempting logout");
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      console.log("[Auth Debug] Logout successful");
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      setLocation("/auth");
    },
    onError: (error: Error) => {
      console.error("[Auth Debug] Logout failed:", error);
      toast({
        title: "تسجيل الخروج فشل",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}