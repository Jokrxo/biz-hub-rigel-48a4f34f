import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export const PurchaseOrders = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Purchase Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Purchase orders management will be implemented here.</p>
      </CardContent>
    </Card>
  );
};
