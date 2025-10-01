import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, FileText, AlertCircle } from "lucide-react";

export const TaxOverview = () => {
  const stats = [
    { title: "Current VAT Due", value: "R 45,680.75", period: "Q1 2024", icon: DollarSign, color: "text-primary" },
    { title: "Next Filing Date", value: "7 Feb 2024", period: "7 days left", icon: Calendar, color: "text-accent" },
    { title: "Submitted Returns", value: "12", period: "This year", icon: FileText, color: "text-primary" },
    { title: "Pending Action", value: "1", period: "Review required", icon: AlertCircle, color: "text-amber-500" },
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
              <p className="text-xs text-muted-foreground mt-1">{stat.period}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
