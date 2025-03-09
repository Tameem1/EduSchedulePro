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

export default function ManagerResults() {
  // Sample data for demonstration
  const sampleResponses = [
    {
      id: 1,
      appointmentId: 1,
      studentName: "سعد الشمري",
      teacherId: 201,
      teacherName: "الأستاذة نوف العتيبي",
      question1: "عملنا على معادلات الجبر وتحليل التعابير.",
      question2: "ساعدني النهج خطوة بخطوة في فهم التحليل.",
      question3: "ما زلت بحاجة إلى مساعدة في المعادلات الأكثر تعقيدًا.",
      question4: "أود التركيز على المسائل الكلامية في المرة القادمة.",
      rating: "4.5",
      createdAt: new Date().setHours(10, 30, 0, 0),
    },
    {
      id: 2,
      appointmentId: 2,
      studentName: "هند السلمي",
      teacherId: 202,
      teacherName: "الأستاذ عبدالله المالكي",
      question1: "راجعنا مقالتي عن تغير المناخ.",
      question2: "كانت الملاحظات على بيان الأطروحة مفيدة جدًا.",
      question3: "أحتاج إلى العمل أكثر على فقرة المقدمة.",
      question4: "أود المزيد من التدريب على أنماط الاقتباس.",
      rating: "5",
      createdAt: new Date().setHours(12, 15, 0, 0),
    },
    {
      id: 3,
      appointmentId: 4,
      studentName: "ريم الدوسري",
      teacherId: 203,
      teacherName: "الدكتور فهد القرني",
      question1: "غطينا مشتقات حساب التفاضل والتكامل وتطبيقاتها.",
      question2: "جعلت الأمثلة الواقعية المفاهيم أوضح.",
      question3: "تطبيقات قاعدة السلسلة لا تزال صعبة.",
      question4: "أود ممارسة المزيد من مسائل التكامل.",
      rating: "4",
      createdAt: new Date().setHours(15, 0, 0, 0),
    },
    {
      id: 4,
      appointmentId: 5,
      studentName: "جيمس رودريغيز",
      teacherId: 201,
      teacherName: "السيدة جونسون",
      question1: "عملنا على براهين الهندسة ونظرياتها.",
      question2: "ساعدتني الرسوم التوضيحية المرئية على فهم المفاهيم.",
      question3: "أحتاج إلى المزيد من التدريب على الهندسة الإحداثية.",
      question4: "أود تغطية مواضيع متقدمة في هندسة ثلاثية الأبعاد.",
      rating: "4.5",
      createdAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    },
    {
      id: 5,
      appointmentId: 6,
      studentName: "أوليفيا براون",
      teacherId: 202,
      teacherName: "السيد سميث",
      question1: "راجعنا قواعد اللغة وبنية الجمل.",
      question2: "كان تفكيك الجمل المعقدة مفيدًا جدًا.",
      question3: "ما زلت أصارع في تحديد الصوت السلبي.",
      question4: "أود العمل على أسلوب كتابتي في المرة القادمة.",
      rating: "3.5",
      createdAt: new Date(new Date().setDate(new Date().getDate() - 2)),
    },
  ];

  const { data: responses } = useQuery({
    queryKey: ["/api/questionnaire-responses"],
    initialData: sampleResponses,
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
                      <TableHead>هل تمت متابعة الطالب؟</TableHead>
                      <TableHead>هل استجاب؟</TableHead>
                      <TableHead>ماذا سمع؟</TableHead>
                      <TableHead>المعلم</TableHead>
                      <TableHead>الطالب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayResponses.map((response: any) => (
                      <TableRow key={response.id}>
                        <TableCell className="text-center">
                          {Math.random() > 0.3 ? "نعم" : "لا"}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.random() > 0.3 ? "نعم" : "لا"}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.random() > 0.3 ? "نعم" : "لا"}
                        </TableCell>
                        <TableCell>
                          {response.teacherName ||
                            `معلم رقم ${response.teacherId || 1}`}
                        </TableCell>
                        <TableCell className="font-medium">
                          {response.studentName}
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
                            <TableHead>هل تمت متابعة الطالب؟</TableHead>
                            <TableHead>هل استجاب؟</TableHead>
                            <TableHead>ماذا سمع؟</TableHead>
                            <TableHead>المعلم</TableHead>
                            <TableHead>الطالب</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedResponses[date].map((response: any) => (
                            <TableRow key={response.id}>
                              <TableCell className="text-center">
                                {Math.random() > 0.3 ? "نعم" : "لا"}
                              </TableCell>
                              <TableCell className="text-center">
                                {Math.random() > 0.3 ? "نعم" : "لا"}
                              </TableCell>
                              <TableCell className="text-center">
                                {Math.random() > 0.3 ? "نعم" : "لا"}
                              </TableCell>
                              <TableCell>
                                {response.teacherName ||
                                  `معلم رقم ${response.teacherId || 1}`}
                              </TableCell>
                              <TableCell className="font-medium">
                                {response.studentName}
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
      </Tabs>
    </div>
  );
}
