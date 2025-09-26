import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";

const reports = [
  {
    name: "Profit & Loss Statement",
    description: "Comprehensive income statement for the period",
    period: "January 2024",
    lastGenerated: "2024-01-15",
    status: "Current",
    icon: TrendingUp
  },
  {
    name: "Balance Sheet",
    description: "Assets, liabilities and equity position",
    period: "January 2024", 
    lastGenerated: "2024-01-15",
    status: "Current",
    icon: BarChart3
  },
  {
    name: "Cash Flow Statement",
    description: "Cash inflows and outflows analysis",
    period: "January 2024",
    lastGenerated: "2024-01-15", 
    status: "Current",
    icon: Activity
  },
  {
    name: "Trial Balance",
    description: "Summary of all account balances",
    period: "January 2024",
    lastGenerated: "2024-01-15",
    status: "Current", 
    icon: PieChart
  }
];

const profitLossData = [
  { account: "Sales Revenue", amount: 2847390.50, type: "income" },
  { account: "Cost of Sales", amount: 1420695.25, type: "expense" }, 
  { account: "Gross Profit", amount: 1426695.25, type: "subtotal" },
  { account: "Operating Expenses", amount: 487230.75, type: "expense" },
  { account: "Rent & Utilities", amount: 186000.00, type: "expense" },
  { account: "Salaries & Wages", amount: 245680.50, type: "expense" },
  { account: "Professional Fees", amount: 55550.25, type: "expense" },
  { account: "Net Profit Before Tax", amount: 939464.50, type: "total" },
  { account: "Income Tax", amount: 263289.26, type: "expense" },
  { account: "Net Profit After Tax", amount: 676175.24, type: "final" }
];

export const FinancialReports = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate and view comprehensive financial statements and reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Change Period
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90 gap-2">
            <FileText className="h-4 w-4" />
            Generate All Reports
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Profit</p>
                <p className="text-xl font-bold">R 1.43M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-xl font-bold">R 676K</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Flow</p>
                <p className="text-xl font-bold">R 1.25M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <PieChart className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-xl font-bold">23.7%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Reports */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Available Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => (
              <div key={report.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{report.name}</h4>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Period: {report.period} • Last updated: {report.lastGenerated}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-primary">
                    {report.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="h-3 w-3" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sample P&L Statement */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Profit & Loss Statement - January 2024
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Account</TableHead>
                  <TableHead className="text-right font-semibold">Amount (ZAR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitLossData.map((item, index) => (
                  <TableRow 
                    key={index} 
                    className={`${item.type === 'subtotal' || item.type === 'total' || item.type === 'final' ? 'bg-muted/30 font-medium' : ''}`}
                  >
                    <TableCell 
                      className={`${item.type === 'total' || item.type === 'final' ? 'font-bold' : ''} ${
                        item.type === 'expense' ? 'pl-8' : ''
                      }`}
                    >
                      {item.account}
                    </TableCell>
                    <TableCell 
                      className={`text-right font-mono ${
                        item.type === 'income' || item.type === 'subtotal' || item.type === 'total' || item.type === 'final' ? 'text-primary font-bold' : 
                        item.type === 'expense' ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {item.type === 'expense' ? '(' : ''}
                      R {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      {item.type === 'expense' ? ')' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Generated on: {new Date().toLocaleDateString('en-ZA')} • Period: January 2024
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};