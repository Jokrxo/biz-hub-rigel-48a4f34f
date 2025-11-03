import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Download, Edit, Trash2, Receipt, ArrowUpDown, Calendar, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { TransactionFormEnhanced } from "./TransactionFormEnhanced";
import { exportTransactionsToExcel, exportTransactionsToPDF } from "@/lib/export-utils";

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  total_amount: number;
  status: string;
  bank_account_id: string | null;
  transaction_type: string | null;
  category: string | null;
  entries?: any[];
  bank_accounts?: { account_name: string; bank_name: string } | null;
}

export const TransactionManagement = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          bank_account:bank_accounts(bank_name, account_number),
          entries:transaction_entries(
            id,
            account_id,
            debit,
            credit,
            description,
            status,
            chart_of_accounts(account_code, account_name)
          )
        `)
        .eq("company_id", profile.company_id)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setItems(data || []);
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
      type: (t as any).transaction_type || (t.total_amount >= 0 ? "Income" : "Expense"),
      category: (t as any).category || "—",
      bank: (t as any).bank_account ? `${(t as any).bank_account.bank_name} (${(t as any).bank_account.account_number})` : "—",
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

  const allocateTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw error;

      await supabase
        .from("transaction_entries")
        .update({ status: "approved" })
        .eq("transaction_id", id);

      toast({ title: "Success", description: "Transaction allocated" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Transaction deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportData = derived.filtered.map(t => ({
      date: t.date,
      description: t.description,
      type: t.type,
      amount: t.amount,
      vatAmount: t.vatAmount,
      reference: t.reference
    }));
    
    if (confirm("Export as Excel or PDF? (OK = Excel, Cancel = PDF)")) {
      exportTransactionsToExcel(exportData);
    } else {
      exportTransactionsToPDF(exportData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button className="bg-gradient-primary hover:opacity-90" onClick={() => { setEditData(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
        
        <TransactionFormEnhanced
          open={open}
          onOpenChange={setOpen}
          onSuccess={load}
          editData={editData}
        />
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
            <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />Export</Button>
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
                  <TableHead className="w-32">Bank</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="text-right w-24">VAT</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.filtered.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{transaction.date}</div></TableCell>
                    <TableCell><div><div className="font-medium">{transaction.description}</div><div className="text-sm text-muted-foreground">{transaction.reference}</div></div></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{transaction.bank}</TableCell>
                    <TableCell><Badge variant={transaction.type === "Income" ? "default" : "secondary"} className={transaction.type === "Income" ? "bg-primary" : ""}>{transaction.type}</Badge></TableCell>
                    <TableCell className="text-sm">{transaction.category}</TableCell>
                    <TableCell className="text-right font-mono"><span className={transaction.type === "Income" ? "text-primary" : "text-muted-foreground"}>R {transaction.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></TableCell>
                    <TableCell className="text-right font-mono text-sm">R {transaction.vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge variant={transaction.status === "Cleared" ? "default" : "outline"} className={transaction.status === "Cleared" ? "bg-primary" : ""}>{transaction.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {transaction.status === "pending" && (
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={() => allocateTransaction(transaction.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Allocate
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditData(transaction); setOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteTransaction(transaction.id)}>
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