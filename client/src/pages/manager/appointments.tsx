
import * as React from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

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
  
  // Sample teacher data for demonstration purposes
  const sampleTeachers = [
    { id: "t1", username: "John Smith" },
    { id: "t2", username: "Emily Johnson" },
    { id: "t3", username: "Michael Chen" },
    { id: "t4", username: "Sarah Williams" },
    { id: "t5", username: "David Rodriguez" }
  ];
  
  // Sample availability data
  const sampleAvailabilities = React.useMemo(() => {
    const today = new Date();
    return [
      { 
        id: "a1", 
        teacherId: "t1", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString()
      },
      { 
        id: "a2", 
        teacherId: "t1", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).toISOString()
      },
      { 
        id: "a3", 
        teacherId: "t2", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30).toISOString()
      },
      { 
        id: "a4", 
        teacherId: "t2", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0).toISOString()
      },
      { 
        id: "a5", 
        teacherId: "t3", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0).toISOString()
      },
      { 
        id: "a6", 
        teacherId: "t4", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30).toISOString()
      },
      { 
        id: "a7", 
        teacherId: "t4", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0).toISOString()
      },
      { 
        id: "a8", 
        teacherId: "t5", 
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 30).toISOString(),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30).toISOString()
      }
    ];
  }, []);
  
  // Sample appointment counts
  const sampleAppointments = [
    { teacherId: "t1", count: 3 },
    { teacherId: "t2", count: 2 },
    { teacherId: "t3", count: 1 },
    { teacherId: "t4", count: 4 },
    { teacherId: "t5", count: 0 }
  ];
  
  // Use real data if available, otherwise use sample data
  const displayTeachers = React.useMemo(() => {
    return (teachers && teachers.length > 0) ? teachers : sampleTeachers;
  }, [teachers]);
  
  const displayAvailabilities = React.useMemo(() => {
    return (availabilities && availabilities.length > 0) ? availabilities : sampleAvailabilities;
  }, [availabilities, sampleAvailabilities]);

  // State for teacher assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [selectedAppointment, setSelectedAppointment] = React.useState(null);

  // Function to find available teachers for a specific time
  const findAvailableTeachers = (appointmentTime) => {
    if (!appointmentTime) return [];
    
    const appointmentDate = new Date(appointmentTime);
    
    return displayTeachers.filter(teacher => {
      // Find teacher availabilities
      const teacherAvailabilities = displayAvailabilities.filter(
        (a) => a.teacherId === teacher.id
      );
      
      // Check if the teacher is available at the appointment time
      return teacherAvailabilities.some(availability => {
        const startTime = new Date(availability.startTime);
        const endTime = new Date(availability.endTime);
        return appointmentDate >= startTime && appointmentDate <= endTime;
      });
    });
  };

  // Handle opening the assign dialog
  const handleAssignClick = (appointment) => {
    setSelectedAppointment(appointment);
    setAssignDialogOpen(true);
  };

  // Handle assigning a teacher
  const handleAssignTeacher = (teacherId) => {
    // In a real app, this would make an API call to update the appointment
    console.log(`Assigning teacher ${teacherId} to appointment ${selectedAppointment.id}`);
    setAssignDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-4">
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
              {(appointments?.length ? appointments : [
                    { id: 1, studentName: "Michael Johnson", studentId: 101, startTime: new Date().setHours(10, 0), teacherId: 201, status: "matched" },
                    { id: 2, studentName: "Sarah Chen", studentId: 102, startTime: new Date().setHours(11, 30), teacherId: 202, status: "pending" },
                    { id: 3, studentName: "David Wilson", studentId: 103, startTime: new Date().setHours(13, 0), teacherId: null, status: "pending" },
                    { id: 4, studentName: "Emma Thompson", studentId: 104, startTime: new Date().setHours(14, 30), teacherId: 203, status: "completed" },
                    { id: 5, studentName: "James Rodriguez", studentId: 105, startTime: new Date().setHours(16, 0), teacherId: 201, status: "matched" }
                  ]).map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>#{appointment.id}</TableCell>
                  <TableCell>{appointment.studentName || `Student ${appointment.studentId}`}</TableCell>
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
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAssignClick(appointment)}
                    >
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
              {displayTeachers.map((teacher) => {
                const teacherAvailabilities = displayAvailabilities.filter(
                  (a) => a.teacherId === teacher.id
                );

                // Get appointment count for this teacher (from real or sample data)
                const appointmentCount = appointments?.filter(a => a.teacherId === teacher.id)?.length || 
                  sampleAppointments.find(a => a.teacherId === teacher.id)?.count || 0;

                return (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>
                      {teacherAvailabilities?.length > 0 ? (
                        <div className="space-y-1">
                          {teacherAvailabilities.map((avail, idx) => (
                            <div key={idx} className="text-sm flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span>
                                {format(new Date(avail.startTime), "h:mm a")} - {format(new Date(avail.endTime), "h:mm a")}
                              </span>
                              {idx === 0 && teacher.id === "t1" && (
                                <span className="text-xs text-blue-500 ml-2">Morning slot</span>
                              )}
                              {idx === 1 && teacher.id === "t1" && (
                                <span className="text-xs text-blue-500 ml-2">Afternoon slot</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No availability set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-medium">{appointmentCount}</span>
                        {appointmentCount > 0 && (
                          <Badge variant="outline" className="ml-2">
                            {appointmentCount > 2 ? "High" : "Normal"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Teacher Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Teacher</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4">
              <div className="mb-4">
                <p className="font-medium">Appointment Details</p>
                <p className="text-sm text-muted-foreground">
                  Student: {selectedAppointment.studentName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Time: {format(new Date(selectedAppointment.startTime), "h:mm a")}
                </p>
              </div>
              
              <div className="mb-4">
                <p className="font-medium mb-2">Available Teachers</p>
                <div className="space-y-2">
                  {findAvailableTeachers(selectedAppointment.startTime).length > 0 ? (
                    findAvailableTeachers(selectedAppointment.startTime).map(teacher => (
                      <div 
                        key={teacher.id} 
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAssignTeacher(teacher.id)}
                      >
                        <span>{teacher.username}</span>
                        <Button size="sm" variant="secondary">Select</Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No teachers available at this time</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
