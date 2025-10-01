import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const Bills = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Bills
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Bills management will be implemented here.</p>
      </CardContent>
    </Card>
  );
};
