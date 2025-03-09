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
  const { data: responses } = useQuery({
    queryKey: ["/api/questionnaire-responses"],
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
          <ResultsTable responses={responses?.filter((r: any) => 
            format(new Date(r.createdAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
          )} />
        </TabsContent>

        <TabsContent value="history">
          {groupedResponses && Object.entries(groupedResponses)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, dayResponses]) => (
              <Card key={date} className="mb-6">
                <CardHeader>
                  <CardTitle>{format(new Date(date), "MMMM d, yyyy")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResultsTable responses={dayResponses} />
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultsTable({ responses }: { responses: any[] }) {
  if (!responses?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No reports available for this period.
      </div>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Topics Covered</TableHead>
              <TableHead>Areas for Improvement</TableHead>
              <TableHead>Recommendations</TableHead>
              <TableHead>Teacher ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {responses.map((response: any) => (
              <TableRow key={response.id}>
                <TableCell>{format(new Date(response.createdAt), "h:mm a")}</TableCell>
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
  );
}