import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export const DataManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClearAllData = async () => {
    if (password !== "Admin123") {
      toast({
        title: "Error",
        description: "Incorrect password",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDeleting(true);

      // Get current user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile?.company_id) {
        throw new Error("Company not found");
      }

      const companyId = profile.company_id;

      // Delete data in order (child tables first to avoid FK constraints)
      // 1) Collect parent IDs for scoping child deletes
      const { data: txIdsRows } = await supabase
        .from("transactions")
        .select("id")
        .eq("company_id", companyId);
      const txIds = (txIdsRows || []).map((r: any) => r.id);

      const { data: billRows } = await supabase
        .from("bills")
        .select("id")
        .eq("company_id", companyId);
      const billIds = (billRows || []).map((r: any) => r.id);

      const { data: invRows } = await supabase
        .from("invoices")
        .select("id")
        .eq("company_id", companyId);
      const invIds = (invRows || []).map((r: any) => r.id);

      const { data: poRows } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("company_id", companyId);
      const poIds = (poRows || []).map((r: any) => r.id);

      const { data: quoteRows } = await supabase
        .from("quotes")
        .select("id")
        .eq("company_id", companyId);
      const quoteIds = (quoteRows || []).map((r: any) => r.id);

      const { data: loanRows } = await supabase
        .from("loans" as any)
        .select("id")
        .eq("company_id", companyId);
      const loanIds = (loanRows || []).map((r: any) => r.id);

      const { data: payRunRows } = await supabase
        .from("pay_runs" as any)
        .select("id")
        .eq("company_id", companyId);
      const payRunIds = (payRunRows || []).map((r: any) => r.id);

      // 2) Child tables scoped deletes
      if (txIds.length) {
        await supabase.from("transaction_entries").delete().in("transaction_id", txIds as any);
      }
      await supabase.from("ledger_entries").delete().eq("company_id", companyId);

      if (billIds.length) {
        await supabase.from("bill_items").delete().in("bill_id", billIds as any);
      }
      if (invIds.length) {
        await supabase.from("invoice_items").delete().in("invoice_id", invIds as any);
      }
      if (poIds.length) {
        await supabase.from("purchase_order_items").delete().in("purchase_order_id", poIds as any);
      }
      if (quoteIds.length) {
        await supabase.from("quote_items").delete().in("quote_id", quoteIds as any);
      }
      if (loanIds.length) {
        await supabase.from("loan_payments" as any).delete().in("loan_id", loanIds as any);
      }
      if (payRunIds.length) {
        await supabase.from("pay_run_lines" as any).delete().in("pay_run_id", payRunIds as any);
      }
      await supabase.from("account_categories").delete().eq("company_id", companyId);

      // 3) Parent tables
      await supabase.from("transactions").delete().eq("company_id", companyId);
      await supabase.from("bills").delete().eq("company_id", companyId);
      await supabase.from("invoices").delete().eq("company_id", companyId);
      await supabase.from("purchase_orders").delete().eq("company_id", companyId);
      await supabase.from("quotes").delete().eq("company_id", companyId);
      await supabase.from("sales").delete().eq("company_id", companyId);
      await supabase.from("expenses").delete().eq("company_id", companyId);
      await supabase.from("trial_balances").delete().eq("company_id", companyId);
      await supabase.from("financial_reports").delete().eq("company_id", companyId);
      await supabase.from("budgets").delete().eq("company_id", companyId);
      await supabase.from("budget_periods").delete().eq("company_id", companyId);

      await supabase.from("loans" as any).delete().eq("company_id", companyId);
      await supabase.from("pay_runs" as any).delete().eq("company_id", companyId);

      await supabase.from("employees" as any).delete().eq("company_id", companyId);

      await supabase.from("bank_accounts").delete().eq("company_id", companyId);
      await supabase.from("fixed_assets").delete().eq("company_id", companyId);
      await supabase.from("items").delete().eq("company_id", companyId);
      await supabase.from("customers").delete().eq("company_id", companyId);
      await supabase.from("suppliers").delete().eq("company_id", companyId);
      await supabase.from("categories").delete().eq("company_id", companyId);
      await supabase.from("chart_of_accounts").delete().eq("company_id", companyId);
      await supabase.from("branches").delete().eq("company_id", companyId);

      toast({
        title: "Success",
        description: "All data has been cleared successfully",
      });

      setIsDialogOpen(false);
      setPassword("");
      
      // Reload the page after a short delay
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear data",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Data Management
        </CardTitle>
        <CardDescription>
          Manage system data and perform testing operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/10 p-6">
          <h3 className="font-semibold text-lg">Repair Orphan Transactions</h3>
          <p className="text-sm text-muted-foreground mt-1">Find transactions without entries and auto-generate balanced entries using Bank/Income/Expense heuristics.</p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("company_id")
                  .eq("user_id", user?.id)
                  .single();
                if (!profile?.company_id) throw new Error("Company not found");
                const { data, error } = await supabase.rpc('repair_orphan_transactions', { _company_id: profile.company_id });
                if (error) throw error;
                const repaired = typeof data === 'number' ? data : 0;
                toast({ title: "Repair Complete", description: `${repaired} transaction(s) fixed` });
              } catch (e: any) {
                toast({ title: "Repair Failed", description: e.message, variant: "destructive" });
              }
            }}
          >Run Repair</Button>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
          <div className="flex items-start gap-4">
            <Trash2 className="h-6 w-6 text-destructive mt-1" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-lg">Clear All Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete all data from the system including transactions,
                  invoices, bills, customers, suppliers, and all other records. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Data Deletion
              </DialogTitle>
              <DialogDescription>
                This action will permanently delete all data from your company. 
                Enter the password to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
                <p className="text-xs text-muted-foreground">
                  Password: Admin123
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setPassword("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAllData}
                disabled={isDeleting || !password}
              >
                {isDeleting ? "Deleting..." : "Delete All Data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
