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

  // Define the useQuery hook first so we can use refetchUser in useEffect
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
    retry: 1, // Retry once in case of network glitches
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 1000 * 60 * 60, // Consider data fresh for 1 hour
    initialData: null, // Explicitly set initial data to null
  });

  // Add effect to handle localStorage persistence
  useEffect(() => {
    console.log("[Auth Debug] AuthProvider mounted");
    
    // Function to validate stored user with server and auto-login
    const validateUserAndRedirect = async () => {
      // Check for user data in localStorage on mount
      const storedUser = localStorage.getItem('authUser');
      if (storedUser && !user) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log("[Auth Debug] Found user in localStorage:", parsedUser.username);
          
          if (!parsedUser.username || !parsedUser.section) {
            console.error("[Auth Debug] Invalid stored user data");
            localStorage.removeItem('authUser');
            return;
          }

          console.log("[Auth Debug] Attempting auto-login with stored credentials");
          
          // Attempt server-side authentication using stored data
          try {
            // Set the user in the query cache temporarily
            queryClient.setQueryData(["/api/user"], parsedUser);
            
            // Try to perform an API request that requires auth to verify user is really logged in
            const res = await fetch('/api/user', {
              credentials: 'include',
            });
            
            if (res.status === 401) {
              console.log("[Auth Debug] Session expired, attempting to re-login");
              // If not authenticated, we need to log in
              const loginRes = await fetch('/api/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  username: parsedUser.username,
                  password: parsedUser.password,
                  section: parsedUser.section,
                }),
                credentials: 'include',
              });
              
              if (!loginRes.ok) {
                console.error("[Auth Debug] Auto-login failed, clearing stored credentials");
                localStorage.removeItem('authUser');
                queryClient.setQueryData(["/api/user"], null);
                return;
              }
              
              const userData = await loginRes.json();
              console.log("[Auth Debug] Auto-login successful");
              queryClient.setQueryData(["/api/user"], userData);
            } else if (res.ok) {
              // We are already authenticated
              console.log("[Auth Debug] User is already authenticated with server");
              const userData = await res.json();
              queryClient.setQueryData(["/api/user"], userData);
            } else {
              // Some other error
              console.error("[Auth Debug] Error validating user with server");
              localStorage.removeItem('authUser');
              queryClient.setQueryData(["/api/user"], null);
              return;
            }
          } catch (error) {
            console.error("[Auth Debug] Network error during auto-login:", error);
            return;
          }
          
          // Auto redirect to appropriate dashboard based on role
          const currentPath = window.location.pathname;
          if (currentPath === '/' || currentPath === '/auth') {
            console.log("[Auth Debug] Auto-redirecting to dashboard based on stored user role");
            switch (parsedUser.role) {
              case "teacher":
                setLocation("/teacher/appointments");
                break;
              case "student":
                setLocation("/student/book-appointment");
                break;
              case "manager":
                setLocation("/manager/appointments");
                break;
            }
          }
        } catch (error) {
          console.error("[Auth Debug] Error parsing stored user data:", error);
          localStorage.removeItem('authUser');
        }
      }
    };
    
    validateUserAndRedirect();
    
    return () => console.log("[Auth Debug] AuthProvider unmounted");
  }, [refetchUser, user, setLocation]);

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
      
      // Store user info in localStorage for persistence
      localStorage.setItem('authUser', JSON.stringify(user));
      console.log("[Auth Debug] User data saved to localStorage");
      
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
      
      // Store user info in localStorage for persistence
      localStorage.setItem('authUser', JSON.stringify(user));
      console.log("[Auth Debug] User data saved to localStorage after registration");
      
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
      
      // Clear localStorage auth data
      localStorage.removeItem('authUser');
      console.log("[Auth Debug] User data removed from localStorage");
      
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