import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck } from "lucide-react";

export const TaxReturns = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          Tax Returns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Tax returns filing and management will be implemented here.</p>
      </CardContent>
    </Card>
  );
};
