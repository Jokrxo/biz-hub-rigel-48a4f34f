import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Mail, Phone, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_number?: string;
}

export const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_number: "",
    opening_balance: "",
    opening_balance_date: new Date().toISOString().slice(0, 10),
  });

  const loadSuppliers = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();
      if (!profile) throw new Error("Profile not found");
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("name");
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }

    try {
      if (formData.phone) {
        const { isTenDigitPhone } = await import("@/lib/validators");
        if (!isTenDigitPhone(formData.phone)) {
          toast({ title: "Invalid phone", description: "Phone number must be 10 digits", variant: "destructive" });
          return;
        }
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const { error, data: inserted } = await supabase.from("suppliers").insert({
        company_id: profile!.company_id,
        ...formData,
      }).select('id').single();

      if (error) throw error;

      toast({ title: "Success", description: "Supplier added successfully" });
      setDialogOpen(false);
      // Post opening balance to Accounts Payable if provided
      try {
        const obAmt = Number(formData.opening_balance || 0);
        if (obAmt > 0) {
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_name, account_type, account_code')
            .eq('company_id', profile!.company_id)
            .eq('is_active', true);
          const list = (accounts || []).map(a => ({ id: String(a.id), name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
          const pick = (type: string, codes: string[], names: string[]) => {
            const byCode = list.find(a => a.type === type && codes.includes(a.code));
            if (byCode) return byCode.id;
            const byName = list.find(a => a.type === type && names.some(n => a.name.includes(n)));
            if (byName) return byName.id;
            const byType = list.find(a => a.type === type);
            return byType?.id || "";
          };
          const apId = pick('liability', ['2000'], ['accounts payable','payable']);
          const equityObId = pick('equity', ['3999'], ['opening balance','opening']);
          if (apId) {
            const { data: tx } = await supabase
              .from('transactions')
              .insert({
                company_id: profile!.company_id,
                user_id: user?.id,
                transaction_date: formData.opening_balance_date,
                description: `Opening balance for supplier ${formData.name}`,
                reference_number: `SUP-OB-${inserted?.id || ''}`,
                total_amount: obAmt,
                transaction_type: 'opening',
                status: 'posted'
              })
              .select('id')
              .single();
            if (tx?.id) {
              const rows = [
                { transaction_id: tx.id, account_id: equityObId || pick('equity', [], ['equity']), debit: obAmt, credit: 0, description: 'Opening Balance Equity', status: 'approved' },
                { transaction_id: tx.id, account_id: apId, debit: 0, credit: obAmt, description: 'Accounts Payable', status: 'approved' }
              ];
              await supabase.from('transaction_entries').insert(rows as any);
              const ledgerRows = rows.map(r => ({ company_id: profile!.company_id, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: formData.opening_balance_date, is_reversed: false, transaction_id: tx.id, description: r.description }));
              await supabase.from('ledger_entries').insert(ledgerRows as any);
            }
          }
        }
      } catch {}
      setFormData({ name: "", email: "", phone: "", address: "", tax_number: "", opening_balance: "", opening_balance_date: new Date().toISOString().slice(0, 10) });
      loadSuppliers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;
  const [page, setPage] = useState(0);
  const [pageSize] = useState(7);
  const totalCount = suppliers.length;
  const start = page * pageSize;
  const pagedSuppliers = suppliers.slice(start, start + pageSize);
  useEffect(() => { setPage(0); }, [suppliers.length]);
  const [statementOpen, setStatementOpen] = useState<boolean>(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Suppliers
          </CardTitle>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Supplier Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Supplier name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="supplier@email.com"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Physical address"
                    />
                  </div>
                <div>
                  <Label>Tax Number</Label>
                  <Input
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    placeholder="Tax registration number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Opening Balance</Label>
                    <Input
                      type="number"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Opening Balance Date</Label>
                    <Input
                      type="date"
                      value={formData.opening_balance_date}
                      onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                    />
                  </div>
                </div>
                  <Button type="submit" className="w-full bg-gradient-primary">
                    Add Supplier
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No suppliers added yet</div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Tax Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.tax_number || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => { setStatementSupplier(supplier); setStatementOpen(true); }}>
                      <FileText className="h-3 w-3 mr-1" /> Statement
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {pagedSuppliers.length} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
              <Button variant="outline" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
          </>
        )}
      </CardContent>
      <SupplierStatement
        supplierId={statementSupplier?.id || ""}
        supplierName={statementSupplier?.name || ""}
        open={statementOpen}
        onOpenChange={(v) => { setStatementOpen(v); if (!v) setStatementSupplier(null); }}
      />
    </Card>
  );
};
import { SupplierStatement } from "@/components/Purchase/SupplierStatement";
