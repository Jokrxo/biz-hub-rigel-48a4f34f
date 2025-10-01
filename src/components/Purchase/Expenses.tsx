import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export const Expenses = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Expenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Expense tracking will be implemented here.</p>
      </CardContent>
    </Card>
  );
};
