import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ManagerAppointments() {
  const { data: appointments } = useQuery({
    queryKey: ["/api/appointments"],
  });

  const { data: teachers } = useQuery({
    queryKey: ["/api/users/teachers"],
  });

  const { data: availabilities } = useQuery({
    queryKey: ["/api/availabilities"],
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Appointment Management</h1>
        <Link href="/manager/results">
          <Button>View Results</Button>
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Teacher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments?.map((appointment: any) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{appointment.studentId}</TableCell>
                    <TableCell>{format(new Date(appointment.startTime), "PPP p")}</TableCell>
                    <TableCell>{appointment.status}</TableCell>
                    <TableCell>{appointment.teacherId || "Unassigned"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teacher Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availabilities?.map((availability: any) => (
                  <TableRow key={availability.id}>
                    <TableCell>{availability.teacherId}</TableCell>
                    <TableCell>{format(new Date(availability.startTime), "PPP p")}</TableCell>
                    <TableCell>{format(new Date(availability.endTime), "p")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
