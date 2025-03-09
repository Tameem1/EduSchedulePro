import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

export default function TeacherAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date>();

  const addAvailabilityMutation = useMutation({
    mutationFn: async (date: Date) => {
      const startTime = new Date(date);
      const endTime = new Date(date);
      endTime.setHours(endTime.getHours() + 1);

      const res = await apiRequest("POST", "/api/availabilities", {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Availability Added",
        description: "Your availability has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", user!.id, "availabilities"] });
    },
  });

  const { data: availabilities } = useQuery({
    queryKey: ["/api/teachers", user!.id, "availabilities"],
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Manage Availability</h1>
        <Link href="/teacher/questionnaire">
          <Button>Go to Questionnaire</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Availability</CardTitle>
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
            disabled={!selectedDate || addAvailabilityMutation.isPending}
            onClick={() => selectedDate && addAvailabilityMutation.mutate(selectedDate)}
          >
            Add Availability
          </Button>

          {availabilities && availabilities.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Your Available Slots</h3>
              <div className="space-y-2">
                {availabilities.map((availability: any) => (
                  <div key={availability.id} className="p-4 border rounded-md">
                    <p>Start: {format(new Date(availability.startTime), "PPP p")}</p>
                    <p>End: {format(new Date(availability.endTime), "p")}</p>
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
