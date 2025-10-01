import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";

export const PurchaseOverview = () => {
  const stats = [
    { title: "Unpaid Bills", value: "R 156,890", count: 12, icon: AlertCircle, color: "text-amber-500" },
    { title: "Overdue Bills", value: "R 32,450", count: 2, icon: Clock, color: "text-destructive" },
    { title: "Paid Bills", value: "R 1,547,200", count: 98, icon: CheckCircle, color: "text-primary" },
    { title: "Total Outstanding", value: "R 189,340", count: 14, icon: FileText, color: "text-accent" },
  ];

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-professional">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.count} bills</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-professional">
        <CardHeader>
          <CardTitle>Age Analysis Report (Accounts Payable)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Current (0-30 days)</span>
              <span className="font-bold text-primary">R 78,450</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">31-60 days</span>
              <span className="font-bold text-amber-500">R 46,890</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">61-90 days</span>
              <span className="font-bold text-amber-600">R 31,550</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">90+ days (Overdue)</span>
              <span className="font-bold text-destructive">R 32,450</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
