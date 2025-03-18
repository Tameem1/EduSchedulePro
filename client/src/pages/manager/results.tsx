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
import { arSA } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import type { QuestionnaireResponse } from "@shared/schema";
import { DatePicker } from "@/components/ui/date-picker";
import type { DateRange } from "react-day-picker";

export default function ManagerResults() {
  const [dateRange, setDateRange] = React.useState<{
    from: Date;
    to: Date;
  }>({
    from: new Date(),
    to: new Date(),
  });

  // Fetch questionnaire responses
  const { data: responses, isLoading: responsesLoading } = useQuery<QuestionnaireResponse[]>({
    queryKey: ["/api/questionnaire-responses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/questionnaire-responses");
      if (!res.ok) {
        throw new Error("Failed to fetch questionnaire responses");
      }
      return res.json();
    },
  });

  // Fetch statistics with date range
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/statistics", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const res = await apiRequest("GET", `/api/statistics?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch statistics");
      }
      return res.json();
    },
  });

  const groupedResponses = responses?.reduce((acc: any, response: any) => {
    const date = format(new Date(response.createdAt), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(response);
    return acc;
  }, {});

  const todayResponses =
    responses?.filter(
      (r: any) =>
        format(new Date(r.createdAt), "yyyy-MM-dd") ===
        format(new Date(), "yyyy-MM-dd"),
    ) || [];

  const allDates = Object.keys(groupedResponses || {});

  if (responsesLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">نتائج الجلسات</h1>
        <Link href="/manager/appointments">
          <Button variant="outline">العودة إلى المواعيد</Button>
        </Link>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">تقارير اليوم</TabsTrigger>
          <TabsTrigger value="history">السجل</TabsTrigger>
          <TabsTrigger value="statistics">الإحصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>تقارير جلسات اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              {todayResponses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>ماذا سمع؟</TableHead>
                      <TableHead>هل استجاب؟</TableHead>
                      <TableHead>هل تمت متابعة الطالب؟</TableHead>
                      <TableHead>المعلم</TableHead>
                      <TableHead>الطالب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayResponses.map((response: any) => (
                      <TableRow key={response.id}>
                        <TableCell>{response.question4}</TableCell>
                        <TableCell>{response.question3}</TableCell>
                        <TableCell>{response.question2}</TableCell>
                        <TableCell>{response.question1}</TableCell>
                        <TableCell>
                          {response.teacherName ||
                            `معلم رقم ${response.teacherId || 1}`}
                        </TableCell>
                        <TableCell className="font-medium">
                          {response.studentName || `طالب ${response.studentId}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    لم يتم تقديم تقارير اليوم
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>جميع تقارير الجلسات</CardTitle>
            </CardHeader>
            <CardContent>
              {allDates.length > 0 ? (
                <div className="space-y-6">
                  {allDates.map((date) => (
                    <div
                      key={date}
                      className="border-b pb-4 mb-4 last:border-0"
                    >
                      <h3 className="text-lg font-medium mb-3">
                        {format(new Date(date), "PPPP", { locale: arSA })}
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>ماذا سمع؟</TableHead>
                            <TableHead>هل استجاب؟</TableHead>
                            <TableHead>هل تمت متابعة الطالب؟</TableHead>
                            <TableHead>المعلم</TableHead>
                            <TableHead>الطالب</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedResponses[date].map((response: any) => (
                            <TableRow key={response.id}>
                              <TableCell>{response.question4}</TableCell>
                              <TableCell>{response.question3}</TableCell>
                              <TableCell>{response.question2}</TableCell>
                              <TableCell>{response.question1}</TableCell>
                              <TableCell>
                                {response.teacherName ||
                                  `معلم رقم ${response.teacherId || 1}`}
                              </TableCell>
                              <TableCell className="font-medium">
                                {response.studentName || `طالب ${response.studentId}`}
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
                  <p className="text-muted-foreground">
                    لا توجد تقارير سابقة متاحة
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات الطلاب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <DatePicker
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={arSA}
                />
              </div>

              {statistics && statistics.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم الطالب</TableHead>
                      <TableHead>عدد الإجابات بنعم (س١)</TableHead>
                      <TableHead>عدد الإجابات بنعم (س٢)</TableHead>
                      <TableHead>جميع الإجابات (س٣)</TableHead>
                      <TableHead>عدد المهام المستقلة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics.map((stat: any) => (
                      <TableRow key={stat.studentId}>
                        <TableCell className="font-medium">
                          {stat.studentName}
                        </TableCell>
                        <TableCell>{stat.question1YesCount}</TableCell>
                        <TableCell>{stat.question2YesCount}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {stat.question3Responses}
                        </TableCell>
                        <TableCell>
                          {stat.independentAssignments?.length || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    لا توجد إحصائيات متاحة للفترة المحددة
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}