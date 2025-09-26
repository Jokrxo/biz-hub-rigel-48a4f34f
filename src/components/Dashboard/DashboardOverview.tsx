import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  AlertTriangle,
  Calendar,
  FileText,
  CreditCard
} from "lucide-react";

const metrics = [
  {
    title: "Total Revenue",
    value: "R 2,847,390.50",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    description: "vs last month"
  },
  {
    title: "Outstanding Invoices",
    value: "R 189,450.00",
    change: "-8.2%",
    trend: "down",
    icon: FileText,
    description: "15 invoices pending"
  },
  {
    title: "VAT Due",
    value: "R 45,680.75",
    change: "+5.8%",
    trend: "up",
    icon: Receipt,
    description: "Due: 7 days"
  },
  {
    title: "Cash Flow",
    value: "R 1,247,890.25",
    change: "+18.3%",
    trend: "up",
    icon: CreditCard,
    description: "Available funds"
  }
];

const recentTransactions = [
  { id: "TXN-001", description: "Client Payment - Acme Corp", amount: "R 25,000.00", type: "income", date: "2024-01-15" },
  { id: "TXN-002", description: "Office Rent", amount: "R 15,500.00", type: "expense", date: "2024-01-14" },
  { id: "TXN-003", description: "Equipment Purchase", amount: "R 8,750.00", type: "expense", date: "2024-01-14" },
  { id: "TXN-004", description: "Consulting Fee - XYZ Ltd", amount: "R 32,000.00", type: "income", date: "2024-01-13" },
];

const alerts = [
  { type: "warning", message: "VAT return due in 7 days", priority: "high" },
  { type: "info", message: "Monthly financial reports ready", priority: "medium" },
  { type: "error", message: "3 overdue invoices require attention", priority: "high" },
];

export const DashboardOverview = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your financial overview for ABC Trading (Pty) Ltd
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Jan 2024
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="card-professional animate-float hover:animate-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metric.value}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant={metric.trend === "up" ? "default" : "secondary"}
                  className={metric.trend === "up" ? "bg-primary" : ""}
                >
                  {metric.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {metric.change}
                </Badge>
                <span className="text-xs text-muted-foreground">{metric.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="card-professional lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${
                        transaction.type === 'income' ? 'bg-primary' : 'bg-accent'
                      }`} />
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">{transaction.id} • {transaction.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${
                    transaction.type === 'income' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{transaction.amount}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All Transactions
            </Button>
          </CardContent>
        </Card>

        {/* Alerts & Tasks */}
        <Card className="card-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              Alerts & Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    alert.priority === 'high' ? 'bg-destructive' : 
                    alert.priority === 'medium' ? 'bg-accent' : 'bg-primary'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{alert.message}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {alert.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Quick Actions */}
            <div className="mt-6 space-y-2">
              <h4 className="font-medium text-foreground">Quick Actions</h4>
              <div className="grid gap-2">
                <Button variant="outline" size="sm" className="justify-start">
                  Generate VAT Return
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Export Financial Reports
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Reconcile Bank Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle>Financial Health Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cash Flow Health</span>
                <span className="text-sm text-primary font-bold">85%</span>
              </div>
              <Progress value={85} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Strong cash position</p>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Invoice Collection</span>
                <span className="text-sm text-accent font-bold">72%</span>
              </div>
              <Progress value={72} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Room for improvement</p>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Tax Compliance</span>
                <span className="text-sm text-primary font-bold">95%</span>
              </div>
              <Progress value={95} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Excellent compliance</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};