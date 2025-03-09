import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect } from "wouter";
import { insertUserSchema, UserRole } from "@shared/schema";

const loginSchema = insertUserSchema.pick({ 
  username: true, 
  password: true 
});

const registerSchema = insertUserSchema;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      role: UserRole.STUDENT,
    },
  });

  if (user) {
    const roleRedirects = {
      [UserRole.STUDENT]: "/",
      [UserRole.TEACHER]: "/teacher/availability",
      [UserRole.MANAGER]: "/manager/appointments",
    };
    return <Redirect to={roleRedirects[user.role]} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-4xl w-full px-4 flex gap-8">
        <div className="flex-1">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="login">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
                  <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input {...loginForm.register("username")} />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input type="password" {...loginForm.register("password")} />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        Login
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input {...registerForm.register("username")} />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input type="password" {...registerForm.register("password")} />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select 
                          onValueChange={(value) => registerForm.setValue("role", value as UserRoleType)}
                          defaultValue={registerForm.getValues("role")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UserRole.STUDENT}>Student</SelectItem>
                            <SelectItem value={UserRole.TEACHER}>Teacher</SelectItem>
                            <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        Register
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 hidden lg:block">
          <div className="h-full flex flex-col justify-center">
            <h1 className="text-4xl font-bold mb-4">
              Appointment Scheduling System
            </h1>
            <p className="text-lg text-gray-600">
              Welcome to our appointment scheduling system. Register or login to:
            </p>
            <ul className="mt-4 space-y-2 text-gray-600">
              <li>• Book appointments as a student</li>
              <li>• Manage your availability as a teacher</li>
              <li>• Oversee all appointments as a manager</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
