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
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { arSA } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ManagerResults() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = React.useState<{
    from: Date;
    to: Date;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedSection, setSelectedSection] = React.useState<string>("all");

  // Add state for filtered statistics
  const [filteredStatistics, setFilteredStatistics] = React.useState<any[]>([]);

  // Fetch all statistics once when authenticated
  const { data: allStatistics, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/statistics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics");
      if (!res.ok) {
        throw new Error("Failed to fetch statistics");
      }
      return res.json();
    },
    enabled: !!user?.id && user.role === "manager",
  });

  // Get unique sections from statistics
  const sections = React.useMemo(() => {
    if (!allStatistics) return [];
    const uniqueSections = new Set<string>();
    
    allStatistics.forEach((stat: any) => {
      if (stat.section && typeof stat.section === 'string') {
        uniqueSections.add(stat.section);
      }
    });
    
    return Array.from(uniqueSections);
  }, [allStatistics]);

  // Set initial filtered statistics when data is loaded
  React.useEffect(() => {
    if (allStatistics) {
      console.log("Initial statistics loaded:", allStatistics);
      setFilteredStatistics(allStatistics);
    }
  }, [allStatistics]);

  // Handle filter button click - filter data client-side
  const handleFilter = () => {
    console.log("Filtering with date range and section:", {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      section: selectedSection,
    });

    if (!allStatistics) {
      console.log("No statistics available to filter");
      return;
    }

    const filtered = allStatistics.map((stat: any) => {
      // First check section filter
      if (selectedSection !== "all" && stat.section !== selectedSection) {
        return null;
      }

      let hasActivityInRange = false;
      let followUpCount = 0;
      let responseCount = 0;
      const filteredResponses: string[] = [];

      // Process questionnaire responses
      stat.question3Responses.forEach((response: string) => {
        try {
          const dateStr = response.split(' - ')[0];
          const currentYear = new Date().getFullYear();
          const responseDate = new Date(`${currentYear}/${dateStr}`);
          
          if (isWithinInterval(responseDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          })) {
            hasActivityInRange = true;
            followUpCount++;
            responseCount++;
            filteredResponses.push(response);
          }
        } catch (error) {
          console.error("Error parsing response date:", error);
        }
      });

      // Process assignment responses
      stat.assignmentResponses.forEach((response: string) => {
        try {
          const dateStr = response.split(' - ')[0];
          const currentYear = new Date().getFullYear();
          const assignmentDate = new Date(`${currentYear}/${dateStr}`);
          
          if (isWithinInterval(assignmentDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          })) {
            hasActivityInRange = true;
            filteredResponses.push(response);
          }
        } catch (error) {
          console.error("Error parsing assignment date:", error);
        }
      });

      if (!hasActivityInRange) {
        return null;
      }

      return {
        ...stat,
        question1YesCount: followUpCount,
        question2YesCount: responseCount,
        allResponses: filteredResponses.join(' | ')
      };
    }).filter(Boolean);

    console.log("Filtered statistics:", filtered);
    setFilteredStatistics(filtered);
  };

  // Handle loading states
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect if not authenticated or not a manager
  if (!user || user.role !== "manager") {
    setLocation("/auth");
    return null;
  }

  if (statsLoading) {
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

      <Tabs defaultValue="statistics">
        <TabsList className="mb-4">
          <TabsTrigger value="statistics">الإحصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات الطلاب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-4 mb-4">
                <Select
                  value={selectedSection}
                  onValueChange={(value) => setSelectedSection(value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DatePicker
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range) {
                      setDateRange(range);
                    }
                  }}
                  locale={arSA}
                />
                <Button
                  onClick={handleFilter}
                  disabled={!dateRange.from || !dateRange.to}
                >
                  تصفية
                </Button>
              </div>

              {filteredStatistics && filteredStatistics.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم الطالب</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>عدد مرات المتابعة</TableHead>
                      <TableHead>عدد مرات الاستجابة</TableHead>
                      <TableHead>الإنتاج</TableHead>
                      <TableHead>تاريخ آخر نشاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStatistics.map((stat: any) => (
                      <TableRow key={stat.studentId}>
                        <TableCell className="font-medium">
                          {stat.studentName}
                        </TableCell>
                        <TableCell>{stat.section}</TableCell>
                        <TableCell>{stat.question1YesCount}</TableCell>
                        <TableCell>{stat.question2YesCount}</TableCell>
                        <TableCell>
                          <div className="max-w-md overflow-x-auto whitespace-nowrap">
                            {stat.allResponses}
                          </div>
                        </TableCell>
                        <TableCell>
                          {stat.createdAt
                            ? format(new Date(stat.createdAt), "yyyy/MM/dd", {
                                locale: arSA,
                              })
                            : "-"}
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