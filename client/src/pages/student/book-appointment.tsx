import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function BookAppointment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date>();

  const bookAppointmentMutation = useMutation({
    mutationFn: async (date: Date) => {
      const res = await apiRequest("POST", "/api/appointments", {
        startTime: date.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment Requested",
        description: "A teacher will contact you soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students", user!.id, "appointments"] });
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["/api/students", user!.id, "appointments"],
  });

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Book an Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
          
          <Button 
            className="w-full"
            disabled={!selectedDate || bookAppointmentMutation.isPending}
            onClick={() => selectedDate && bookAppointmentMutation.mutate(selectedDate)}
          >
            Request Appointment
          </Button>

          {appointments && appointments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Appointments</h3>
              <div className="space-y-2">
                {appointments.map((appointment: any) => (
                  <div key={appointment.id} className="p-4 border rounded-md">
                    <p>Date: {format(new Date(appointment.startTime), "PPP")}</p>
                    <p>Status: {appointment.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
