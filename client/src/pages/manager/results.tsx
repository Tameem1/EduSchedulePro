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
      if (stat.section && typeof stat.section === "string") {
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

    const filtered = allStatistics
      .filter((stat: any) => {
        // First apply section filter if a specific section is selected
        if (selectedSection !== "all" && stat.section !== selectedSection) {
          return false;
        }

        let hasActivityInRange = false;

        // Check questionnaire responses date if exists
        if (stat.createdAt) {
          try {
            const responseDate = new Date(stat.createdAt);
            if (
              isWithinInterval(responseDate, {
                start: startOfDay(dateRange.from),
                end: endOfDay(dateRange.to),
              })
            ) {
              hasActivityInRange = true;
            }
          } catch (error) {
            console.error("Error parsing response date:", error);
          }
        }

        // Check assignment responses if they exist
        if (
          stat.assignmentResponses &&
          Array.isArray(stat.assignmentResponses) &&
          stat.assignmentResponses.length > 0
        ) {
          for (const assignmentResponse of stat.assignmentResponses) {
            try {
              // Format is "MM/dd - مهمة: Assignment Name"
              const dateStr = assignmentResponse.split(" - ")[0];
              if (dateStr) {
                // Create a date using the current year for comparison
                const currentYear = new Date().getFullYear();
                const assignmentDate = new Date(`${currentYear}/${dateStr}`);

                if (
                  isWithinInterval(assignmentDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to),
                  })
                ) {
                  hasActivityInRange = true;
                  break;
                }
              }
            } catch (error) {
              console.error(
                "Error parsing assignment date:",
                error,
                "for string:",
                assignmentResponse,
              );
            }
          }
        }

        return hasActivityInRange;
      })
      .map((stat: any) => {
        // Create a deep copy of the stat to avoid mutating the original
        const filteredStat = { ...stat };

        // Reset counters for filtering
        filteredStat.question1YesCount = 0;
        filteredStat.question2YesCount = 0;

        // Filter question3Responses by date and count filtered responses
        const filteredQuestion3Responses: string[] = [];
        if (stat.question3Responses && Array.isArray(stat.question3Responses)) {
          stat.question3Responses.forEach((response: string) => {
            try {
              const dateStr = response.split(" - ")[0];
              if (dateStr) {
                const currentYear = new Date().getFullYear();
                const responseDate = new Date(`${currentYear}/${dateStr}`);

                if (
                  isWithinInterval(responseDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to),
                  })
                ) {
                  filteredQuestion3Responses.push(response);

                  // Since we don't have direct access to the original question1/question2 values,
                  // we need to increment these counters differently
                  // This is handled in the next step by analyzing all responses in the filtered date range
                }
              }
            } catch (error) {
              console.error(
                "Error parsing response date:",
                error,
                "for string:",
                response,
              );
            }
          });
        }
        filteredStat.question3Responses = filteredQuestion3Responses;

        // Filter assignmentResponses by date
        const filteredAssignmentResponses: string[] = [];
        if (
          stat.assignmentResponses &&
          Array.isArray(stat.assignmentResponses)
        ) {
          stat.assignmentResponses.forEach((response: string) => {
            try {
              const dateStr = response.split(" - ")[0];
              if (dateStr) {
                const currentYear = new Date().getFullYear();
                const responseDate = new Date(`${currentYear}/${dateStr}`);

                if (
                  isWithinInterval(responseDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to),
                  })
                ) {
                  filteredAssignmentResponses.push(response);
                }
              }
            } catch (error) {
              console.error(
                "Error parsing assignment date:",
                error,
                "for string:",
                response,
              );
            }
          });
        }
        filteredStat.assignmentResponses = filteredAssignmentResponses;

        // Recalculate allResponses based on filtered responses
        const allResponses = [
          ...filteredStat.question3Responses,
          ...filteredStat.assignmentResponses,
        ]
          .sort(
            (a, b) =>
              new Date(a.split(" - ")[0]).getTime() -
              new Date(b.split(" - ")[0]).getTime(),
          )
          .join(" | ");

        filteredStat.allResponses = allResponses;

        // For both questions and assignments, we'll calculate what percentage is in the date range
        const originalQuestionResponseCount = stat.question3Responses.length;
        const filteredQuestionResponseCount =
          filteredStat.question3Responses.length;

        // This approach considers all responses (questions and assignments) for calculation
        const totalOriginalCount =
          originalQuestionResponseCount + stat.assignmentResponses.length;
        const totalFilteredCount =
          filteredQuestionResponseCount +
          filteredStat.assignmentResponses.length;

        if (totalOriginalCount > 0) {
          // Calculate what percentage of all activities is in the filtered range
          const filterRatio = totalFilteredCount / totalOriginalCount;

          // Apply the ratio to the original counts
          // Makes sure to at least include the minimum number of actual responses we found in the date range
          filteredStat.question1YesCount = Math.min(
            stat.question1YesCount,
            Math.max(
              filteredQuestionResponseCount,
              Math.round(stat.question1YesCount * filterRatio),
            ),
          );

          filteredStat.question2YesCount = Math.min(
            stat.question2YesCount,
            Math.max(
              filteredQuestionResponseCount,
              Math.round(stat.question2YesCount * filterRatio),
            ),
          );
        } else {
          filteredStat.question1YesCount = 0;
          filteredStat.question2YesCount = 0;
        }

        return filteredStat;
      });

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
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="bader">بدر</SelectItem>
                    <SelectItem value="mahmoud">محمود</SelectItem>
                    <SelectItem value="motaa">مطاع</SelectItem>
                    <SelectItem value="omar">عمر</SelectItem>
                    <SelectItem value="aasem">عاصم</SelectItem>
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
