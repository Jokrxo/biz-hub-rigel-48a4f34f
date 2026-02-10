import React from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

const PlaceholderPage = () => {
  const location = useLocation();
  const title = location.pathname.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Page";

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <Card className="w-full max-w-2xl mx-auto mt-10 border-dashed">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Construction className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>This module has been built and is ready to be displayed.</p>
            <p className="text-sm mt-2">(Content placeholder for {location.pathname})</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PlaceholderPage;
