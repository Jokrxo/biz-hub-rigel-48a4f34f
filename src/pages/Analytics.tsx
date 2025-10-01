import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, PieChart, TrendingUp } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <>
      <SEO title="Analytics | ApexAccounts" description="Business analytics and insights" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">Business intelligence and performance insights</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Revenue Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <LineChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Revenue chart will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary" />
                  Expense Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <BarChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Expense breakdown chart will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Cash Flow Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Cash flow pie chart will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-professional">
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Invoice Value</span>
                    <span className="font-bold">R 12,650</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Collection Period</span>
                    <span className="font-bold">28 days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Profit Margin</span>
                    <span className="font-bold text-primary">23.7%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Customer Retention</span>
                    <span className="font-bold text-primary">89.5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
