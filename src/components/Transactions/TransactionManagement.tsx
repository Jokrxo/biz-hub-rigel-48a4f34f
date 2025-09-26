import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter, 
  Download,
  Edit,
  Trash2,
  Receipt,
  ArrowUpDown,
  Calendar
} from "lucide-react";

const mockTransactions = [
  {
    id: "TXN-2024-001",
    date: "2024-01-15",
    description: "Client Payment - Acme Corporation",
    type: "Income",
    category: "Sales Revenue",
    amount: 25000.00,
    vatAmount: 3750.00,
    account: "Current Account",
    reference: "INV-001",
    status: "Cleared"
  },
  {
    id: "TXN-2024-002", 
    date: "2024-01-14",
    description: "Office Rent - January 2024",
    type: "Expense",
    category: "Rent & Utilities",
    amount: 15500.00,
    vatAmount: 2325.00,
    account: "Current Account",
    reference: "RENT-JAN",
    status: "Pending"
  },
  {
    id: "TXN-2024-003",
    date: "2024-01-14", 
    description: "Computer Equipment Purchase",
    type: "Expense",
    category: "Equipment",
    amount: 8750.00,
    vatAmount: 1312.50,
    account: "Equipment Account",
    reference: "PO-445",
    status: "Cleared"
  },
  {
    id: "TXN-2024-004",
    date: "2024-01-13",
    description: "Consulting Services - XYZ Limited",
    type: "Income", 
    category: "Professional Services",
    amount: 32000.00,
    vatAmount: 4800.00,
    account: "Current Account",
    reference: "INV-002",
    status: "Cleared"
  }
];

export const TransactionManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredTransactions = mockTransactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || transaction.type.toLowerCase() === filterType.toLowerCase();
    const matchesStatus = filterStatus === "all" || transaction.status.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = filteredTransactions
    .filter(t => t.type === "Expense") 
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transaction Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage all your business transactions and financial entries
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R {totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              R {totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
              R {(totalIncome - totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="card-professional">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
            
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Transactions ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">
                    <Button variant="ghost" className="gap-1 p-0 h-auto font-medium">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="text-right w-24">VAT</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {transaction.date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.id} • {transaction.reference}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.type === "Income" ? "default" : "secondary"}
                        className={transaction.type === "Income" ? "bg-primary" : ""}
                      >
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{transaction.category}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={transaction.type === "Income" ? "text-primary" : "text-muted-foreground"}>
                        R {transaction.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      R {transaction.vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.status === "Cleared" ? "default" : "outline"}
                        className={transaction.status === "Cleared" ? "bg-primary" : ""}
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};