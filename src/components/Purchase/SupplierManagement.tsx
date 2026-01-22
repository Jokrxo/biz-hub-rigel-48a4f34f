import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Building2, Plus, Mail, Phone, FileText, Search, MoreHorizontal, Edit, Check, History, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { SupplierStatement } from "@/components/Purchase/SupplierStatement";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_number: "",
    opening_balance: "",
    opening_balance_date: new Date().toISOString().slice(0, 10),
  });

  // Deactivate State
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [supplierToDeactivate, setSupplierToDeactivate] = useState<Supplier | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

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

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const lower = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(lower) || 
      (s.email && s.email.toLowerCase().includes(lower)) ||
      (s.phone && s.phone.includes(lower)) ||
      (s.tax_number && s.tax_number.includes(lower))
    );
  }, [suppliers, searchTerm]);

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
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        tax_number: formData.tax_number || null,
      }).select('id').single();

      if (error) throw error;

      setSuccessMessage("Supplier added successfully");
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDialogOpen(false);
      }, 2000);
      
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

  const handleDeactivate = async () => {
    if (!supplierToDeactivate) return;
    if (!deactivateReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason.", variant: "destructive" });
      return;
    }
    
    setIsDeactivating(true);
    try {
      const newName = `[INACTIVE] ${supplierToDeactivate.name}`;
      
      const { error } = await supabase
        .from('suppliers')
        .update({ 
            name: newName
        })
        .eq('id', supplierToDeactivate.id);
        
      if (error) throw error;
      toast({ title: "Success", description: "Supplier deactivated" });
      setDeactivateOpen(false);
      setSupplierToDeactivate(null);
      setDeactivateReason("");
      loadSuppliers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsDeactivating(false);
    }
  };

  const canEdit = isAdmin || isAccountant;
  const [statementOpen, setStatementOpen] = useState<boolean>(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  return (
    <Card className="card-professional">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Suppliers</CardTitle>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant hover:shadow-lg transition-all">
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
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="rounded-md border">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No suppliers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tax Number</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {supplier.name.substring(0, 2).toUpperCase()}
                        </div>
                        {supplier.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{supplier.tax_number || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setStatementSupplier(supplier); setStatementOpen(true); }}>
                            <FileText className="mr-2 h-4 w-4" /> View Statement
                          </DropdownMenuItem>
                          {canEdit && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSupplierToDeactivate(supplier);
                                setDeactivateOpen(true);
                              }} className="text-amber-600">
                                <History className="mr-2 h-4 w-4" /> Deactivate / Archive
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <SupplierStatement
          supplierId={statementSupplier?.id || ""}
          supplierName={statementSupplier?.name || ""}
          open={statementOpen}
          onOpenChange={(v) => { setStatementOpen(v); if (!v) setStatementSupplier(null); }}
        />

        <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
          <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
              <Check className="h-12 w-12 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
              <p className="text-muted-foreground">The operation has been completed successfully.</p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-amber-600 flex items-center gap-2">
                <History className="h-5 w-5" />
                Deactivate Supplier
              </DialogTitle>
              <DialogDescription className="pt-2">
                This will mark the supplier as inactive. They cannot be deleted for audit purposes.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm font-medium flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  For audit compliance, suppliers cannot be deleted. Use this form to deactivate them.
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Reason for Deactivation</Label>
                <Textarea 
                  value={deactivateReason} 
                  onChange={(e) => setDeactivateReason(e.target.value)} 
                  placeholder="Reason for deactivation..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Supporting Document (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => document.getElementById('supplier-file-upload')?.click()}>
                  <input type="file" id="supplier-file-upload" className="hidden" onChange={handleFileChange} />
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8 opacity-50" />
                    <span className="text-sm">Click to upload document</span>
                    {file && <span className="text-xs text-primary font-medium">{file.name}</span>}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeactivateOpen(false)} className="w-full sm:w-auto">Dismiss</Button>
              <Button 
                onClick={handleDeactivate}
                disabled={isDeactivating || !deactivateReason.trim()}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isDeactivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <History className="mr-2 h-4 w-4" />
                    Confirm Deactivation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
