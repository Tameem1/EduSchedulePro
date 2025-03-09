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

export default function ManagerResults() {
  const { data: responses } = useQuery({
    queryKey: ["/api/questionnaire-responses"],
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Session Results</h1>
        <Link href="/manager/appointments">
          <Button variant="outline">Back to Appointments</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Topics Covered</TableHead>
                <TableHead>Areas for Improvement</TableHead>
                <TableHead>Recommendations</TableHead>
                <TableHead>Teacher ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses?.map((response: any) => (
                <TableRow key={response.id}>
                  <TableCell>{response.appointmentId}</TableCell>
                  <TableCell>{response.question1}</TableCell>
                  <TableCell>{response.question2}</TableCell>
                  <TableCell>{response.question3}</TableCell>
                  <TableCell>{response.question4}</TableCell>
                  <TableCell>{response.teacherId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
