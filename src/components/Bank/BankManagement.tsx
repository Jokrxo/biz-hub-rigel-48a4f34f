import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Plus, Building2, TrendingUp, TrendingDown } from "lucide-react";
import { CSVImport } from "./CSVImport";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
}

export const BankManagement = () => {
  const { toast } = useToast();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    opening_balance: ""
  });

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
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
        .from("bank_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBanks(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.account_name || !form.account_number || !form.bank_name) {
        toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const openingBalance = parseFloat(form.opening_balance || "0");

      const { error } = await supabase
        .from("bank_accounts")
        .insert({
          company_id: profile.company_id,
          account_name: form.account_name,
          account_number: form.account_number,
          bank_name: form.bank_name,
          opening_balance: openingBalance,
          current_balance: openingBalance
        });

      if (error) throw error;

      toast({ title: "Success", description: "Bank account added successfully" });
      setOpen(false);
      setForm({ account_name: "", account_number: "", bank_name: "", opening_balance: "" });
      loadBanks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalBalance = banks.reduce((sum, bank) => sum + bank.current_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your business bank accounts and transactions</p>
        </div>
        <div className="flex gap-3">
          <CSVImport bankAccounts={banks} onImportComplete={loadBanks} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Add Bank Account
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Account Name *</Label>
                <Input
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  placeholder="e.g. Business Cheque Account"
                />
              </div>
              <div>
                <Label>Bank Name *</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  placeholder="e.g. First National Bank"
                />
              </div>
              <div>
                <Label>Account Number *</Label>
                <Input
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  placeholder="e.g. 62123456789"
                />
              </div>
              <div>
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Add Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bank Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R {totalBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{banks.length} account(s)</p>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="text-2xl font-bold">R 0.00</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Inflows</p>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <div className="text-2xl font-bold">R 0.00</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outflows</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Bank Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : banks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bank accounts yet. Add your first bank account to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.account_name}</TableCell>
                    <TableCell>{bank.bank_name}</TableCell>
                    <TableCell className="font-mono">{bank.account_number}</TableCell>
                    <TableCell className="text-right font-mono">
                      R {bank.opening_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      R {bank.current_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {/* Actions can be added here */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
