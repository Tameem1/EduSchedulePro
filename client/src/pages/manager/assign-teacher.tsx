
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';

export default function AssignTeacher() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch appointment details
  const { data: appointment, isLoading: isLoadingAppointment } = useQuery({
    queryKey: ['/api/appointments', appointmentId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/appointments/${appointmentId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch appointment');
      }
      return res.json();
    },
  });

  // Fetch available teachers
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['/api/users/teachers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users/teachers');
      if (!res.ok) {
        throw new Error('Failed to fetch teachers');
      }
      return res.json();
    },
  });

  // Assign teacher mutation
  const assignTeacherMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      const res = await apiRequest('PATCH', `/api/appointments/${appointmentId}`, {
        teacherId,
        status: 'matched',
      });
      
      if (!res.ok) {
        throw new Error('Failed to assign teacher');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Show success message with notification status
      if (data.notificationSent) {
        toast({
          title: 'تم تعيين المعلم بنجاح',
          description: 'تم إرسال إشعار للمعلم عبر تيليجرام',
          variant: 'default',
        });
      } else {
        toast({
          title: 'تم تعيين المعلم بنجاح',
          description: 'لم يتم إرسال إشعار للمعلم (المعلم ليس لديه معرف تيليجرام)',
          variant: 'default',
        });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Navigate back to appointments list
      navigate('/manager/appointments');
    },
    onError: () => {
      toast({
        title: 'خطأ',
        description: 'فشل في تعيين المعلم',
        variant: 'destructive',
      });
    },
  });

  if (isLoadingAppointment || isLoadingTeachers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>تعيين معلم للموعد</CardTitle>
        </CardHeader>
        <CardContent>
          {appointment && (
            <div className="mb-6 p-4 bg-muted/50 rounded-md">
              <p><span className="font-semibold">رقم الموعد:</span> {appointment.id}</p>
              <p><span className="font-semibold">الطالب:</span> {appointment.studentId}</p>
              <p>
                <span className="font-semibold">الوقت:</span>{" "}
                {format(new Date(appointment.startTime), "yyyy-MM-dd h:mm a")}
              </p>
              <p><span className="font-semibold">الحالة:</span> {appointment.status}</p>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-lg font-medium">اختر معلم</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {teachers?.map((teacher) => (
                <Button
                  key={teacher.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => assignTeacherMutation.mutate(teacher.id)}
                  disabled={assignTeacherMutation.isPending}
                >
                  <div className="font-medium">{teacher.username}</div>
                  <div className="text-sm text-muted-foreground">
                    {teacher.telegramId ? 'متصل بتيليجرام ✓' : 'غير متصل بتيليجرام ✗'}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
