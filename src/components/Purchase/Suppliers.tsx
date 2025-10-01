import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const Suppliers = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Suppliers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Supplier management will be implemented here.</p>
      </CardContent>
    </Card>
  );
};
