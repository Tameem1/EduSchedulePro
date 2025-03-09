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
import { Badge } from "@/components/ui/badge";

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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Today's Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments?.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>#{appointment.id}</TableCell>
                  <TableCell>{appointment.studentName || `Student ${appointment.studentId}`}</TableCell>
                  <TableCell>{format(new Date(appointment.startTime), "h:mm a")}</TableCell>
                  <TableCell>
                    {appointment.teacherId
                      ? teachers?.find(t => t.id === appointment.teacherId)?.username || `Teacher ${appointment.teacherId}`
                      : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        appointment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : appointment.status === 'matched'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">Assign</Button>
                      <Button size="sm" variant="outline">Details</Button>
                    </div>
                  </TableCell>
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
                <TableHead>Available Times</TableHead>
                <TableHead>Appointments Today</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers?.map((teacher) => {
                const teacherAvailabilities = availabilities?.filter(
                  (a) => a.teacherId === teacher.id
                );

                const teacherAppointments = appointments?.filter(
                  (a) => a.teacherId === teacher.id
                );

                return (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>
                      {teacherAvailabilities?.length > 0 ? (
                        <div className="space-y-1">
                          {teacherAvailabilities.map((avail, idx) => (
                            <div key={idx} className="text-sm">
                              {format(new Date(avail.startTime), "h:mm a")} - {format(new Date(avail.endTime), "h:mm a")}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No availability set</span>
                      )}
                    </TableCell>
                    <TableCell>{teacherAppointments?.length}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sample data for demonstration */}
      {!appointments || !teachers || !availabilities ? (
        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-semibold">Sample Data (Demo Only)</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Today's Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: 1, studentName: "Michael Johnson", studentId: 101, startTime: new Date().setHours(10, 0), teacherId: 201, status: "matched" },
                    { id: 2, studentName: "Sarah Chen", studentId: 102, startTime: new Date().setHours(11, 30), teacherId: 202, status: "pending" },
                    { id: 3, studentName: "David Wilson", studentId: 103, startTime: new Date().setHours(13, 0), teacherId: null, status: "pending" },
                    { id: 4, studentName: "Emma Thompson", studentId: 104, startTime: new Date().setHours(14, 30), teacherId: 203, status: "completed" },
                    { id: 5, studentName: "James Rodriguez", studentId: 105, startTime: new Date().setHours(16, 0), teacherId: 201, status: "matched" }
                  ].map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>#{appointment.id}</TableCell>
                      <TableCell>{appointment.studentName}</TableCell>
                      <TableCell>{format(new Date(appointment.startTime), "h:mm a")}</TableCell>
                      <TableCell>
                        {appointment.teacherId
                          ? appointment.teacherId === 201 ? "Ms. Johnson" 
                            : appointment.teacherId === 202 ? "Mr. Smith"
                            : appointment.teacherId === 203 ? "Dr. Williams"
                            : `Teacher ${appointment.teacherId}`
                          : "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'matched'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }
                        >
                          {appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Assign
                        </Button>
                      </TableCell>
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
                    <TableHead>Available Times</TableHead>
                    <TableHead>Appointments Today</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: 201, username: "Ms. Johnson", availabilities: [
                      { startTime: new Date().setHours(9, 0), endTime: new Date().setHours(12, 0) },
                      { startTime: new Date().setHours(14, 0), endTime: new Date().setHours(17, 0) }
                    ], appointmentCount: 2 },
                    { id: 202, username: "Mr. Smith", availabilities: [
                      { startTime: new Date().setHours(11, 0), endTime: new Date().setHours(15, 0) }
                    ], appointmentCount: 1 },
                    { id: 203, username: "Dr. Williams", availabilities: [
                      { startTime: new Date().setHours(13, 0), endTime: new Date().setHours(16, 30) }
                    ], appointmentCount: 1 },
                    { id: 204, username: "Ms. Garcia", availabilities: [], appointmentCount: 0 }
                  ].map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>{teacher.username}</TableCell>
                      <TableCell>
                        {teacher.availabilities?.length > 0 ? (
                          <div className="space-y-1">
                            {teacher.availabilities.map((avail, idx) => (
                              <div key={idx} className="text-sm">
                                {format(new Date(avail.startTime), "h:mm a")} - {format(new Date(avail.endTime), "h:mm a")}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No availability set</span>
                        )}
                      </TableCell>
                      <TableCell>{teacher.appointmentCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}