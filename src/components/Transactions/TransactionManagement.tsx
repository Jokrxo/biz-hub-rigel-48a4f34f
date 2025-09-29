import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Download, Edit, Trash2, Receipt, ArrowUpDown, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { transactionsApi, type TransactionRow } from "@/lib/transactions-api";

export const TransactionManagement = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TransactionRow[]>([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), description: "", amount: "", reference: "" });

  const load = async () => {
    try {
      setLoading(true);
      const data = await transactionsApi.getAll();
      setItems(data);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const derived = useMemo(() => {
    const tx = items.map(t => ({
      id: t.id,
      date: t.transaction_date,
      description: t.description,
      type: t.total_amount >= 0 ? "Income" : "Expense",
      category: "—",
      amount: Math.abs(t.total_amount),
      vatAmount: Math.abs(t.total_amount) * 0.15,
      reference: t.reference_number || "—",
      status: t.status === 'approved' ? 'Cleared' : t.status.charAt(0).toUpperCase() + t.status.slice(1)
    }));

    const filtered = tx.filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type.toLowerCase() === filterType.toLowerCase();
      const matchesStatus = filterStatus === "all" || transaction.status.toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesType && matchesStatus;
    });

    const totalIncome = filtered.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = filtered.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
    return { filtered, totalIncome, totalExpenses };
  }, [items, searchTerm, filterType, filterStatus]);

  const submitNew = async () => {
    try {
      const amount = parseFloat(form.amount);
      if (!form.description || isNaN(amount)) {
        toast({ title: "Invalid data", description: "Provide description and amount", variant: "destructive" });
        return;
      }
      await transactionsApi.create({ date: form.date, description: form.description, amount, reference: form.reference });
      setOpen(false);
      setForm({ date: new Date().toISOString().slice(0,10), description: "", amount: "", reference: "" });
      await load();
      toast({ title: "Transaction added" });
    } catch (e: any) {
      toast({ title: "Failed to add", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transaction Management</h1>
          <p className="text-muted-foreground mt-1">Manage all your business transactions and financial entries</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Client payment" />
              </div>
              <div>
                <label className="text-sm">Amount (ZAR)</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 1250.00" />
              </div>
              <div>
                <label className="text-sm">Reference</label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. INV-001" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submitNew}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R {derived.totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">R {derived.totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${derived.totalIncome - derived.totalExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
              R {(derived.totalIncome - derived.totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-professional">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />More Filters</Button>
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Transactions ({derived.filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32"><Button variant="ghost" className="gap-1 p-0 h-auto font-medium">Date <ArrowUpDown className="h-3 w-3" /></Button></TableHead>
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
                {derived.filtered.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{transaction.date}</div></TableCell>
                    <TableCell><div><div className="font-medium">{transaction.description}</div><div className="text-sm text-muted-foreground">{transaction.id} • {transaction.reference}</div></div></TableCell>
                    <TableCell><Badge variant={transaction.type === "Income" ? "default" : "secondary"} className={transaction.type === "Income" ? "bg-primary" : ""}>{transaction.type}</Badge></TableCell>
                    <TableCell className="text-sm">{transaction.category}</TableCell>
                    <TableCell className="text-right font-mono"><span className={transaction.type === "Income" ? "text-primary" : "text-muted-foreground"}>R {transaction.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></TableCell>
                    <TableCell className="text-right font-mono text-sm">R {transaction.vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge variant={transaction.status === "Cleared" ? "default" : "outline"} className={transaction.status === "Cleared" ? "bg-primary" : ""}>{transaction.status}</Badge></TableCell>
                    <TableCell><div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={async ()=>{try{await transactionsApi.delete(transaction.id);await load();toast({title:'Deleted'});}catch(e:any){toast({title:'Delete failed',description:e.message,variant:'destructive'});}}}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
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