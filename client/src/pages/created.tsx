import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Created() {
  console.log("*** Created component loading ***");
  
  React.useEffect(() => {
    console.log("*** Created component mounted ***");
    return () => console.log("*** Created component unmounted ***");
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-center sm:text-right">
          المواعيد التي أنشأتها (صفحة بسيطة)
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => {
              console.log("Navigating back to appointments");
              window.location.href = "/teacher/appointments";
            }}
          >
            العودة إلى المواعيد
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">صفحة المواعيد التي أنشأتها</p>
          <p className="mt-2">هذه الصفحة قيد التطوير</p>
        </CardContent>
      </Card>
    </div>
  );
}