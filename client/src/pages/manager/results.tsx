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
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function ManagerResults() {
  // Sample data for demonstration
  const sampleResponses = [
    {
      id: 1,
      appointmentId: 1,
      studentName: "Michael Johnson",
      teacherId: 201,
      teacherName: "Ms. Johnson",
      question1: "We worked on algebra equations and factoring expressions.",
      question2: "The step-by-step approach helped me understand factoring.",
      question3: "I still need help with more complex equations.",
      question4: "I would like to focus on word problems next time.",
      rating: "4.5",
      createdAt: new Date().setHours(10, 30, 0, 0),
    },
    {
      id: 2,
      appointmentId: 2,
      studentName: "Sarah Chen",
      teacherId: 202,
      teacherName: "Mr. Smith",
      question1: "We reviewed my essay on climate change.",
      question2: "The feedback on my thesis statement was very helpful.",
      question3: "I need to work more on my introduction paragraph.",
      question4: "I would like more practice with citation formats.",
      rating: "5",
      createdAt: new Date().setHours(12, 15, 0, 0),
    },
    {
      id: 3,
      appointmentId: 4,
      studentName: "Emma Thompson",
      teacherId: 203,
      teacherName: "Dr. Williams",
      question1: "We covered calculus derivatives and applications.",
      question2: "The real-world examples made the concepts clearer.",
      question3: "Chain rule applications are still challenging.",
      question4: "I would like to practice more integration problems.",
      rating: "4",
      createdAt: new Date().setHours(15, 0, 0, 0),
    },
    {
      id: 4,
      appointmentId: 5,
      studentName: "James Rodriguez",
      teacherId: 201,
      teacherName: "Ms. Johnson",
      question1: "We worked on geometry proofs and theorems.",
      question2: "Visual diagrams helped me understand the concepts.",
      question3: "I need more practice with coordinate geometry.",
      question4: "I would like to cover advanced topics in 3D geometry.",
      rating: "4.5",
      createdAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    },
    {
      id: 5,
      appointmentId: 6,
      studentName: "Olivia Brown",
      teacherId: 202,
      teacherName: "Mr. Smith",
      question1: "We reviewed grammar and sentence structure.",
      question2: "Breaking down complex sentences was very useful.",
      question3: "I still struggle with passive voice identification.",
      question4: "I would like to work on my writing style next time.",
      rating: "3.5",
      createdAt: new Date(new Date().setDate(new Date().getDate() - 2)),
    },
  ];

  const { data: responses } = useQuery({
    queryKey: ["/api/questionnaire-responses"],
    initialData: sampleResponses, // Use the sample data when no API data is available
  });

  // Group responses by date
  const groupedResponses = responses?.reduce((acc: any, response: any) => {
    const date = format(new Date(response.createdAt), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(response);
    return acc;
  }, {});

  const todayResponses = responses?.filter((r: any) =>
    format(new Date(r.createdAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
  ) || [];

  const allDates = Object.keys(groupedResponses || {});


  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Session Results</h1>
        <Link href="/manager/appointments">
          <Button variant="outline">Back to Appointments</Button>
        </Link>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">Today's Reports</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>Today's Session Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {todayResponses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Overall Rating</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayResponses.map((response: any) => (
                      <TableRow key={response.id}>
                        <TableCell className="font-medium">{response.studentName}</TableCell>
                        <TableCell>{format(new Date(response.createdAt || new Date()), "h:mm a")}</TableCell>
                        <TableCell>{response.teacherName || `Teacher #${response.teacherId || 1}`}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="text-sm font-medium">{response.rating || "4.5"}/5</span>
                            <div className="ml-2 flex">
                              {Array(5).fill(0).map((_, i) => (
                                <svg
                                  key={i}
                                  className={`w-4 h-4 ${i < Math.floor(response.rating || 4.5) ? "text-yellow-400" : "text-gray-300"}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">View Details</Button>
                            <Button variant="outline" size="sm">Export</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No reports submitted today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>All Session Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {allDates.length > 0 ? (
                <div className="space-y-6">
                  {allDates.map(date => (
                    <div key={date} className="border-b pb-4 mb-4 last:border-0">
                      <h3 className="text-lg font-medium mb-3">{format(new Date(date), "PPPP")}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Teacher</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedResponses[date].map((response: any) => (
                            <TableRow key={response.id}>
                              <TableCell className="font-medium">{response.studentName}</TableCell>
                              <TableCell>{format(new Date(response.createdAt || new Date()), "h:mm a")}</TableCell>
                              <TableCell>{response.teacherName || `Teacher #${response.teacherId || 1}`}</TableCell>
                              <TableCell>{response.rating || "4.5"}/5</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm">View</Button>
                                  <Button variant="outline" size="sm">Export</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No historical reports available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}