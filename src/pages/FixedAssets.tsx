import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Package, Search, Info, Menu } from "lucide-react";
import * as XLSX from "xlsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { calculateDepreciation, updateAssetDepreciation } from "@/components/FixedAssets/DepreciationCalculator";

interface FixedAsset {
  id: string;
  description: string;
  cost: number;
  purchase_date: string;
  useful_life_years: number;
  accumulated_depreciation: number;
  status: string;
  disposal_date?: string;
}

export default function FixedAssetsPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [loanAccounts, setLoanAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string; bank_name?: string }>>([]);
  const [assetFilter, setAssetFilter] = useState<'all' | 'opening' | 'during'>('all');
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disposalDialogOpen, setDisposalDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [deprDialogOpen, setDeprDialogOpen] = useState(false);
  const [deprSelectedAsset, setDeprSelectedAsset] = useState<FixedAsset | null>(null);
  const [deprDate, setDeprDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [deprAmount, setDeprAmount] = useState<string>("");
  const [deprDebitAccountId, setDeprDebitAccountId] = useState<string>("");
  const [deprCreditAccountId, setDeprCreditAccountId] = useState<string>("");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    description: "",
    cost: "",
    purchase_date: "",
    useful_life_years: "5",
    depreciation_method: "straight_line",
    asset_account_id: "",
    funding_source: "bank",
    bank_account_id: "",
    loan_account_id: "",
  });

  const [disposalData, setDisposalData] = useState({
    disposal_date: new Date().toISOString().split("T")[0],
    disposal_amount: "",
    asset_account_id: "",
    bank_account_id: "",
  });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    purchase_date: new Date().toISOString().split("T")[0],
    amount: "",
    asset_account_id: "",
    funding_source: "bank",
    bank_account_id: "",
    loan_account_id: "",
    interest_rate: "",
    loan_term: "",
    loan_term_type: "short",
    vat_applicable: "no",
    useful_life_years: "5",
    depreciation_method: "straight_line",
    description: ""
  });

  const loadAssets = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      setAssets(data || []);

      const { data: faAccounts } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, is_active")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .eq("account_type", "asset")
        .order("account_code");
      const tokens = ['fixed asset','equipment','vehicle','machinery','property','computer','office','plant','building','land','furniture','software'];
      const onlyFixed = (faAccounts || []).filter((a: any) => {
        const code = String(a.account_code || '');
        const name = String(a.account_name || '').toLowerCase();
        return code.startsWith('15') || tokens.some(t => name.includes(t));
      });
      const mapped = (onlyFixed || []).map((a: any) => ({ id: String(a.id), account_code: String(a.account_code || ''), account_name: String(a.account_name || '') }));
      setAssetAccounts(mapped);
      if (!formData.asset_account_id && mapped.length > 0) {
        setFormData(prev => ({ ...prev, asset_account_id: mapped[0].id }));
      }
      if (!purchaseForm.asset_account_id && mapped.length > 0) {
        setPurchaseForm(prev => ({
          ...prev,
          asset_account_id: mapped[0].id,
          description: prev.description || mapped[0].account_name
        }));
      }
      const { data: liabilities } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .eq("account_type", "liability")
        .order("account_code");
      const loanAccs = (liabilities || []).filter((a: any) => ['2300','2400'].includes(String(a.account_code || '')) || String(a.account_name || '').toLowerCase().includes('loan'))
        .map((a: any) => ({ id: String(a.id), account_code: String(a.account_code || ''), account_name: String(a.account_name || '') }));
      setLoanAccounts(loanAccs);
      if (!formData.loan_account_id && loanAccs.length > 0) {
        setFormData(prev => ({ ...prev, loan_account_id: loanAccs[0].id }));
      }
      if (!purchaseForm.loan_account_id && loanAccs.length > 0) {
        setPurchaseForm(prev => ({ ...prev, loan_account_id: loanAccs[0].id }));
      }
      const { data: banks } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name")
        .eq("company_id", profile.company_id)
        .order("account_name");
      setBankAccounts((banks || []).map((b: any) => ({ id: String(b.id), account_name: String(b.account_name || ''), bank_name: String(b.bank_name || '') })));
      if (!formData.bank_account_id && (banks || []).length > 0) {
        setFormData(prev => ({ ...prev, bank_account_id: String((banks || [])[0].id) }));
      }
      if (!purchaseForm.bank_account_id && (banks || []).length > 0) {
        setPurchaseForm(prev => ({ ...prev, bank_account_id: String((banks || [])[0].id) }));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast, formData.asset_account_id, formData.loan_account_id, formData.bank_account_id]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_fixed_assets_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  useEffect(() => {
    if (!selectedAsset) return;
    const norm = String(selectedAsset.description || '').split('[')[0].trim().toLowerCase();
    const byName = assetAccounts.find(a => a.account_name.toLowerCase().includes(norm));
    const byToken = assetAccounts.find(a => {
      const n = a.account_name.toLowerCase();
      return ['fixed asset','equipment','vehicle','machinery','property','computer','office'].some(t => n.includes(t));
    });
    const byCode = assetAccounts.find(a => String(a.account_code || '').startsWith('15'));
    setDisposalData(prev => ({
      ...prev,
      asset_account_id: (byName?.id || byToken?.id || byCode?.id || prev.asset_account_id || ''),
      bank_account_id: (prev.bank_account_id || (bankAccounts[0]?.id || ''))
    }));
  }, [selectedAsset, assetAccounts, bankAccounts]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const dep = calculateDepreciation(parseFloat(formData.cost), formData.purchase_date, parseInt(formData.useful_life_years));
      const { error } = await supabase.from("fixed_assets").insert({
        company_id: profile!.company_id,
        description: `${formData.description} [opening] [method:${formData.depreciation_method}]`,
        cost: parseFloat(formData.cost),
        purchase_date: formData.purchase_date,
        useful_life_years: parseInt(formData.useful_life_years),
        accumulated_depreciation: Number(dep.accumulatedDepreciation.toFixed(2)),
        status: "active",
      });

      if (error) throw error;

      

      try { await supabase.rpc('refresh_afs_cache', { _company_id: profile!.company_id }); } catch {}
      toast({ title: "Success", description: "Opening asset added successfully" });
      setDialogOpen(false);
      setFormData({ description: "", cost: "", purchase_date: "", useful_life_years: "5", depreciation_method: "straight_line", asset_account_id: formData.asset_account_id, funding_source: "bank", bank_account_id: "", loan_account_id: "" });
      loadAssets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const calculateNetBookValue = (asset: FixedAsset) => {
    return asset.cost - asset.accumulated_depreciation;
  };

  const isOpeningAsset = (asset: FixedAsset) => {
    return String(asset.description || '').toLowerCase().includes('[opening]');
  };

  const openingTotal = assets
    .filter((a) => isOpeningAsset(a) && String(a.status || 'active').toLowerCase() !== 'disposed')
    .reduce((sum, a) => sum + Math.max(0, calculateNetBookValue(a)), 0);

  const duringYearTotal = assets
    .filter((a) => !isOpeningAsset(a) && String(a.status || 'active').toLowerCase() !== 'disposed')
    .reduce((sum, a) => sum + Math.max(0, calculateNetBookValue(a)), 0);

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    const nbv = calculateNetBookValue(selectedAsset);
    const disposalAmount = parseFloat(disposalData.disposal_amount);
    if (disposalAmount > nbv) {
      if (!confirm(`Disposal amount (R ${disposalAmount.toLocaleString()}) exceeds Net Book Value (R ${nbv.toLocaleString()}). This will result in a gain. Continue?`)) {
        return;
      }
    }
    let bankLedgerId = '';
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();
      if (!profile?.company_id) throw new Error("Company not found");
      const companyId = profile.company_id as string;

      const { data: coas } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true);
      const bankCoa = (coas || []).find((a: any) => String(a.account_type||'').toLowerCase()==='asset' && (String(a.account_name||'').toLowerCase().includes('bank') || String(a.account_code||'')==='1100'));
      bankLedgerId = String(bankCoa?.id || '');

      const description = `Asset Disposal - ${selectedAsset.description}`;
      const proceeds = disposalAmount || 0;
      const cost = Number(selectedAsset.cost || 0);
      const accum = Number(selectedAsset.accumulated_depreciation || 0);

      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: companyId,
          user_id: user!.id,
          transaction_date: disposalData.disposal_date,
          description,
          reference_number: null,
          total_amount: proceeds,
          bank_account_id: disposalData.bank_account_id || null,
          transaction_type: 'asset_disposal',
          status: 'pending'
        } as any)
        .select('id')
        .single();
      if (txError) throw txError;

      const accDepAccount = (coas || []).find((a: any) => String(a.account_type||'').toLowerCase()==='asset' && (String(a.account_name||'').toLowerCase().includes('accumulated') || String(a.account_name||'').toLowerCase().includes('depreciation')));
      const assetAccId = disposalData.asset_account_id || '';

      const lower = (coas || []).map((a: any) => ({ id: String(a.id), account_type: String(a.account_type||'').toLowerCase(), account_name: String(a.account_name||'').toLowerCase(), account_code: String(a.account_code||'') }));
      const ensureAccount = async (type: 'revenue' | 'expense', name: string, code: string) => {
        const found = lower.find(a => a.account_type === type && (a.account_name.includes(name.toLowerCase()) || a.account_code === code));
        if (found) return found.id;
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: companyId, account_code: code, account_name: name, account_type: type, is_active: true, normal_balance: type === 'revenue' ? 'credit' : 'debit' } as any)
          .select('id')
          .single();
        return String((created as any)?.id || '');
      };

      const gainLoss = proceeds - nbv;
      let gainAccId = '';
      let lossAccId = '';
      if (gainLoss > 0) {
        gainAccId = await ensureAccount('revenue', 'Gain on Sale of Assets', '9500');
      } else if (gainLoss < 0) {
        lossAccId = await ensureAccount('expense', 'Loss on Sale of Assets', '9600');
      }

      const entries: any[] = [];
      if (bankLedgerId && proceeds > 0) {
        entries.push({ transaction_id: tx.id, account_id: bankLedgerId, debit: proceeds, credit: 0, description, status: 'approved' });
      }
      if (accDepAccount && accum > 0) {
        entries.push({ transaction_id: tx.id, account_id: String((accDepAccount as any).id), debit: accum, credit: 0, description: 'Derecognize Accumulated Depreciation', status: 'approved' });
      }
      if (assetAccId && cost > 0) {
        entries.push({ transaction_id: tx.id, account_id: assetAccId, debit: 0, credit: cost, description: 'Derecognize Asset Cost', status: 'approved' });
      }
      if (gainLoss > 0 && gainAccId) {
        entries.push({ transaction_id: tx.id, account_id: gainAccId, debit: 0, credit: gainLoss, description: 'Gain on Asset Disposal', status: 'approved' });
      } else if (gainLoss < 0 && lossAccId) {
        entries.push({ transaction_id: tx.id, account_id: lossAccId, debit: Math.abs(gainLoss), credit: 0, description: 'Loss on Asset Disposal', status: 'approved' });
      }

      const { error: entErr } = await supabase.from('transaction_entries').insert(entries as any);
      if (entErr) throw entErr;

      const totalDebits = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
      const totalCredits = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
      if (Number(totalDebits.toFixed(2)) !== Number(totalCredits.toFixed(2))) {
        throw new Error('Unbalanced disposal entries');
      }

      await supabase.from('ledger_entries').delete().eq('reference_id', tx.id);
      const ledgerRows = entries.map(e => ({
        company_id: companyId,
        account_id: e.account_id,
        entry_date: disposalData.disposal_date,
        description: e.description || description,
        debit: e.debit,
        credit: e.credit,
        reference_id: tx.id,
        transaction_id: tx.id
      }));
      const { error: ledErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
      if (ledErr) throw ledErr;

      await supabase.from('transactions').update({ status: 'approved' }).eq('id', tx.id);
      await supabase.from('transaction_entries').update({ status: 'approved' }).eq('transaction_id', tx.id);

      if (disposalData.bank_account_id) {
        try {
          await supabase.rpc('update_bank_balance', { _bank_account_id: disposalData.bank_account_id, _amount: proceeds, _operation: 'add' });
        } catch {}
      }

      await supabase
        .from('fixed_assets')
        .update({ status: 'disposed', disposal_date: disposalData.disposal_date })
        .eq('id', selectedAsset.id);

      try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}

      toast({ title: 'Success', description: 'Asset disposal posted to transactions' });
      setDisposalDialogOpen(false);
      setSelectedAsset(null);
      setDisposalData({ 
        disposal_date: new Date().toISOString().split('T')[0], 
        disposal_amount: '', 
        asset_account_id: disposalData.asset_account_id || '', 
        bank_account_id: disposalData.bank_account_id || '' 
      });
      loadAssets();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const canEdit = isAdmin || isAccountant;

  const exportAssets = () => {
    const rows = assets.map((a) => ({
      description: a.description,
      purchase_date: a.purchase_date,
      cost: a.cost,
      useful_life_years: a.useful_life_years,
      accumulated_depreciation: a.accumulated_depreciation,
      status: a.status,
      disposal_date: a.disposal_date || "",
      net_book_value: a.cost - a.accumulated_depreciation,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FixedAssets");
    XLSX.writeFile(wb, "fixed_assets.xlsx");
  };

  return (
    <>
      <SEO title="Fixed Assets Register | Rigel Business" description="Manage fixed assets and depreciation" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fixed Assets Register</h1>
              <p className="text-muted-foreground mt-1">Track and manage company fixed assets</p>
            </div>
            <div className="flex gap-3">
              <Button className="bg-gradient-primary" onClick={() => setActionsOpen(true)}>
                <Menu className="h-4 w-4 mr-2" />
                Actions
              </Button>
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogContent className="sm:max-w-[560px] p-4">
                    <DialogHeader>
                      <DialogTitle>Add Opening Fixed Asset</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div>
                        <Label>Description</Label>
                        <div className="grid grid-cols-2 gap-2 items-start">
                          <Input className="h-9"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="e.g., Office Equipment"
                            required
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Select Fixed Asset (Chart of Accounts)</Label>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Select value={formData.asset_account_id} onValueChange={(val) => {
                                  setFormData(prev => ({ ...prev, asset_account_id: val }));
                                  const acc = assetAccounts.find(a => a.id === val);
                                  if (acc?.account_name) setFormData(prev => ({ ...prev, description: acc.account_name }));
                                }}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Choose fixed asset account" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assetAccounts.map(acc => (
                                      <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Popover open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
                                <PopoverTrigger asChild>
                                  <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search fixed asset accounts">
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent side="bottom" align="start" className="w-80 p-0 z-50 shadow-lg border bg-popover">
                                  <Command>
                                    <CommandInput placeholder="Search fixed asset accounts" />
                                    <CommandEmpty>No asset accounts found</CommandEmpty>
                                    <CommandList>
                                      <CommandGroup>
                                        {assetAccounts.map(acc => (
                                          <CommandItem
                                            key={acc.id}
                                            value={`${acc.account_code} ${acc.account_name}`}
                                            onSelect={() => {
                                              setFormData(prev => ({ ...prev, asset_account_id: acc.id, description: acc.account_name }));
                                              setAssetSearchOpen(false);
                                            }}
                                          >
                                            {acc.account_code} - {acc.account_name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Cost (R)</Label>
                        <Input className="h-9"
                          type="number"
                          step="0.01"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Purchase Date</Label>
                        <Input className="h-9"
                          type="date"
                          value={formData.purchase_date}
                          onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Depreciation Method</Label>
                        <Select value={formData.depreciation_method} onValueChange={(val) => setFormData({ ...formData, depreciation_method: val })}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="straight_line">Straight Line</SelectItem>
                            <SelectItem value="diminishing">Diminishing Balance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Useful Life (Years)</Label>
                        <Select value={formData.useful_life_years} onValueChange={(val) => setFormData({ ...formData, useful_life_years: val })}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 7, 10, 15, 20].map((years) => (
                              <SelectItem key={years} value={years.toString()}>{years} years</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-md border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Accumulated Depreciation</span>
                          <span>
                            {(() => {
                              const res = calculateDepreciation(parseFloat(formData.cost || '0'), formData.purchase_date || new Date().toISOString().split('T')[0], parseInt(formData.useful_life_years || '5'));
                              return `R ${Number(res.accumulatedDepreciation || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Net Book Value</span>
                          <span>
                            {(() => {
                              const res = calculateDepreciation(parseFloat(formData.cost || '0'), formData.purchase_date || new Date().toISOString().split('T')[0], parseInt(formData.useful_life_years || '5'));
                              return `R ${Number(res.netBookValue || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-gradient-primary">Add Opening Asset</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetContent className="sm:max-w-[520px]">
              <div className="space-y-4">
                <div className="text-lg font-semibold">Quick Actions</div>
                <div className="text-sm text-muted-foreground">Choose what you want to do. These actions will guide you through a friendly flow.</div>
                <div className="grid gap-3">
                  <Button className="w-full" onClick={() => { setActionsOpen(false); setPurchaseDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Asset (Purchase)
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => { setActionsOpen(false); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Opening Asset
                  </Button>
                  <Button className="w-full" variant="secondary" onClick={() => { setActionsOpen(false); setDeprDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4 mr-2 rotate-180" />
                    Depreciation
                  </Button>
                  <Button className="w-full" variant="outline" disabled={assets.length===0} onClick={() => { exportAssets(); setActionsOpen(false); }}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Register
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => { setActionsOpen(false); setTutorialOpen(true); }}>
                    <Info className="h-4 w-4 mr-2" />
                    Help & Tutorial
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Asset Register
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Opening Book Value</div>
                  <div className="text-2xl font-bold">R {openingTotal.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">During Year Book Value</div>
                  <div className="text-2xl font-bold">R {duringYearTotal.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Estimated Monthly Depreciation</div>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const total = assets
                        .filter(a => String(a.status||'active').toLowerCase() !== 'disposed')
                        .reduce((sum, a) => {
                          const res = calculateDepreciation(Number(a.cost||0), String(a.purchase_date||new Date().toISOString().split('T')[0]), Number(a.useful_life_years||5));
                          return sum + (res.annualDepreciation/12);
                        }, 0);
                      return `R ${Number(total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                    })()}
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">Filter</div>
                  <div className="flex gap-2 mt-2">
                    <Button variant={assetFilter==='all' ? 'default' : 'outline'} size="sm" onClick={() => setAssetFilter('all')}>All</Button>
                    <Button variant={assetFilter==='opening' ? 'default' : 'outline'} size="sm" onClick={() => setAssetFilter('opening')}>Opening</Button>
                    <Button variant={assetFilter==='during' ? 'default' : 'outline'} size="sm" onClick={() => setAssetFilter('during')}>During Year</Button>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : assets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No assets recorded</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Accumulated Depreciation</TableHead>
                      <TableHead className="text-right">Net Book Value</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets
                      .filter(a => assetFilter === 'all' ? true : assetFilter === 'opening' ? isOpeningAsset(a) : !isOpeningAsset(a))
                      .map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.description}</TableCell>
                        <TableCell>{new Date(asset.purchase_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">R {asset.cost.toLocaleString()}</TableCell>
                        <TableCell className="text-right">R {asset.accumulated_depreciation.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">R {calculateNetBookValue(asset).toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${isOpeningAsset(asset) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-primary/10 text-primary'}`}>
                            {isOpeningAsset(asset) ? 'Opening' : 'During Year'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${asset.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {asset.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {asset.status === 'active' && canEdit && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedAsset(asset);
                                const byName = assetAccounts.find(a => a.account_name.toLowerCase().includes((asset.description || '').toLowerCase()));
                                setDisposalData(prev => ({
                                  ...prev,
                                  asset_account_id: (byName?.id || prev.asset_account_id || ''),
                                  bank_account_id: (prev.bank_account_id || (bankAccounts[0]?.id || ''))
                                }));
                                setDisposalDialogOpen(true);
                              }}
                            >
                              Dispose
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader>
                <DialogTitle>Fixed Assets Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>This module is for viewing the assets register and tracking book values.</p>
                <p>To add or purchase new assets, use the Transaction form under Transactions.</p>
                <p>To add existing opening assets, use the Add Opening Asset button in this module.</p>
                <p>To post monthly depreciation, use the Post Monthly Depreciation button. Depreciation reduces book value and appears in reports.</p>
                <p>To dispose assets, use the dispose action; proceeds post to Bank, and the system records gain or loss automatically.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
            <DialogContent className="w-screen sm:max-w-[100vw] h-[92vh] p-4 flex flex-col">
              <div className="sticky top-0 z-40 bg-background border-b">
                <DialogHeader>
                  <DialogTitle>Purchase Fixed Asset</DialogTitle>
                </DialogHeader>
                <div className="px-0 pb-3 flex gap-2 text-sm overflow-x-auto">
                  <Button variant="ghost" size="sm" type="button" onClick={() => document.getElementById('section-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Details</Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => document.getElementById('section-funding')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Funding</Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => document.getElementById('section-amount-vat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Amount & VAT</Button>
                  <Button variant="default" size="sm" type="submit" form="purchase-form">Submit</Button>
                </div>
              </div>
              <form id="purchase-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const { data: profile } = await supabase
                      .from("profiles")
                      .select("company_id")
                      .eq("user_id", user?.id)
                      .single();
                    if (!profile?.company_id) throw new Error("Company not found");
                    const companyId = profile.company_id as string;

                    const amt = Number(purchaseForm.amount || 0);
                    if (!amt || amt <= 0) throw new Error("Invalid amount");
                    if (!purchaseForm.asset_account_id) throw new Error("Select fixed asset account");
                    if (purchaseForm.funding_source === 'bank' && !purchaseForm.bank_account_id) throw new Error("Select bank account");
                    if (purchaseForm.funding_source === 'loan' && !purchaseForm.loan_account_id) throw new Error("Select loan account");
                    const isVat = String(purchaseForm.vat_applicable || 'no') === 'yes';
                    const vatRate = isVat ? 15 : 0;
                    const subtotal = isVat ? Number((amt / 1.15).toFixed(2)) : amt;
                    const taxAmount = isVat ? Number((amt - subtotal).toFixed(2)) : 0;

                    const { data: coas } = await supabase
                      .from("chart_of_accounts")
                      .select("id, account_code, account_name, account_type, is_active")
                      .eq("company_id", companyId)
                      .eq("is_active", true);

                    let bankLedgerId = '';
                    let vatInputId: string | null = null;
                    if (coas && coas.length > 0) {
                      const lower = coas.map((a: any) => ({ id: String(a.id), type: String(a.account_type||'').toLowerCase(), name: String(a.account_name||'').toLowerCase(), code: String(a.account_code||'') }));
                      const bankCoa = lower.find(a => a.type === 'asset' && (a.name.includes('bank') || a.code === '1100'));
                      bankLedgerId = String(bankCoa?.id || '');
                      const vatIn = lower.find(a => a.type === 'liability' && (a.code === '2110' || a.code === '2210' || a.name.includes('vat input') || a.name.includes('vat receivable') || a.name.includes('input tax')));
                      vatInputId = vatIn ? String(vatIn.id) : null;
                    }
                    if (!vatInputId && taxAmount > 0) {
                      try {
                        const { data: created } = await supabase
                          .from('chart_of_accounts')
                          .insert({ company_id: companyId, account_code: '2110', account_name: 'VAT Input', account_type: 'liability', is_active: true })
                          .select('id')
                          .single();
                        vatInputId = String((created as any)?.id || '');
                      } catch {}
                    }

                    const { data: tx, error: txErr } = await supabase
                      .from('transactions')
                      .insert({
                        company_id: companyId,
                        user_id: user!.id,
                        transaction_date: purchaseForm.purchase_date,
                        description: purchaseForm.description ? `Asset Purchase - ${purchaseForm.description}` : 'Asset Purchase',
                        reference_number: null,
                        total_amount: amt,
                        transaction_type: 'asset',
                        status: 'pending',
                        bank_account_id: purchaseForm.funding_source === 'bank' ? (purchaseForm.bank_account_id || null) : null,
                        vat_rate: vatRate > 0 ? vatRate : null,
                        vat_amount: taxAmount > 0 ? taxAmount : null,
                        vat_inclusive: true
                      } as any)
                      .select('id')
                      .single();
                    if (txErr) throw txErr;

                    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [];
                    rows.push({ transaction_id: tx.id, account_id: purchaseForm.asset_account_id, debit: subtotal, credit: 0, description: 'Fixed Asset', status: 'approved' });
                    if (taxAmount > 0 && vatInputId) {
                      rows.push({ transaction_id: tx.id, account_id: vatInputId, debit: taxAmount, credit: 0, description: 'VAT Input', status: 'approved' });
                    }
                    if (purchaseForm.funding_source === 'bank') {
                      if (!bankLedgerId) throw new Error('Bank ledger account missing');
                      rows.push({ transaction_id: tx.id, account_id: bankLedgerId, debit: 0, credit: amt, description: 'Bank', status: 'approved' });
                    } else if (purchaseForm.funding_source === 'loan') {
                      const loanAccId = purchaseForm.loan_account_id || '';
                      if (!loanAccId) throw new Error('Loan account required');
                      rows.push({ transaction_id: tx.id, account_id: loanAccId, debit: 0, credit: amt, description: 'Loan Payable', status: 'approved' });
                    }

                    const { error: teErr } = await supabase.from('transaction_entries').insert(rows as any);
                    if (teErr) throw teErr;

                    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: purchaseForm.purchase_date, is_reversed: false, transaction_id: tx.id, description: r.description }));
                    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
                    if (leErr) throw leErr;

                    await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);
                    if (purchaseForm.funding_source === 'bank' && purchaseForm.bank_account_id) {
                      try { await supabase.rpc('update_bank_balance', { _bank_account_id: purchaseForm.bank_account_id, _amount: amt, _operation: 'subtract' }); } catch {}
                    }

                    if (purchaseForm.funding_source === 'loan') {
                      const irStr = String(purchaseForm.interest_rate || '').trim();
                      const termStr = String(purchaseForm.loan_term || '').trim();
                      if (!irStr || !termStr) throw new Error('Enter interest rate (%) and term (months)');
                      const interestRatePercent = parseFloat(irStr);
                      const interestRateDecimal = interestRatePercent / 100;
                      const termMonths = parseInt(termStr);
                      const monthlyRate = interestRateDecimal / 12;
                      const monthlyRepayment = monthlyRate === 0 ? amt / termMonths : (amt * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
                      const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
                      const rand = Math.random().toString(36).slice(2,8);
                      const refVal = `LN-${today}-${rand}`;
                      try {
                        await supabase
                          .from('loans')
                          .upsert({
                            company_id: companyId,
                            reference: refVal,
                            loan_type: purchaseForm.loan_term_type,
                            principal: amt,
                            interest_rate: interestRateDecimal,
                            start_date: purchaseForm.purchase_date,
                            term_months: termMonths,
                            monthly_repayment: monthlyRepayment,
                            status: 'active',
                            outstanding_balance: amt
                          } as any, { onConflict: 'company_id,reference' });
                      } catch {}
                    }

                    const { error: faErr } = await supabase.from('fixed_assets').insert({
                      company_id: companyId,
                      description: purchaseForm.description,
                      cost: subtotal,
                      purchase_date: purchaseForm.purchase_date,
                      useful_life_years: parseInt(purchaseForm.useful_life_years || '5'),
                      accumulated_depreciation: 0,
                      status: 'active'
                    } as any);
                    if (faErr) throw faErr;

                    try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
                    toast({ title: 'Success', description: 'Asset purchase posted successfully' });
                    setPurchaseDialogOpen(false);
                    setPurchaseForm({
                      purchase_date: new Date().toISOString().split("T")[0],
                      amount: "",
                      asset_account_id: purchaseForm.asset_account_id || "",
                      funding_source: "bank",
                      bank_account_id: purchaseForm.bank_account_id || "",
                      loan_account_id: purchaseForm.loan_account_id || "",
                      interest_rate: "",
                      loan_term: "",
                      loan_term_type: "short",
                      vat_applicable: "no",
                      useful_life_years: purchaseForm.useful_life_years || "5",
                      depreciation_method: purchaseForm.depreciation_method || "straight_line",
                      description: ""
                    });
                    loadAssets();
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  }
                }}
                className="space-y-4"
              >
                <div className="flex-1 overflow-y-auto space-y-4">
                  <div id="section-details" className="space-y-6">
                    <div>
                      <Label>Description</Label>
                      <div className="grid grid-cols-3 gap-2 items-start">
                        <Input className="h-9"
                          value={purchaseForm.description}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                          placeholder="e.g., Office Equipment"
                          required
                        />
                        <div className="space-y-2">
                          <Label className="text-xs">Select Fixed Asset (Chart of Accounts)</Label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={purchaseForm.asset_account_id}
                                onValueChange={(val) => {
                                  const acc = assetAccounts.find((a) => a.id === val);
                                  setPurchaseForm(prev => ({
                                    ...prev,
                                    asset_account_id: val,
                                    description: acc?.account_name || prev.description
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Choose fixed asset account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {assetAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Popover open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search fixed asset accounts">
                                  <Search className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent side="bottom" align="start" className="w-80 p-0 z-50 shadow-lg border bg-popover">
                                <Command>
                                  <CommandInput placeholder="Search fixed asset accounts" />
                                  <CommandEmpty>No asset accounts found</CommandEmpty>
                                  <CommandList>
                                    <CommandGroup>
                                      {assetAccounts.map(acc => (
                                        <CommandItem
                                          key={acc.id}
                                          value={`${acc.account_code} ${acc.account_name}`}
                                          onSelect={() => {
                                            setPurchaseForm(prev => ({ ...prev, asset_account_id: acc.id, description: acc.account_name }));
                                            setAssetSearchOpen(false);
                                          }}
                                        >
                                          {acc.account_code} - {acc.account_name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div>
                          <Label>Purchase Date</Label>
                          <Input className="h-9"
                            type="date"
                            value={purchaseForm.purchase_date}
                            onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Useful Life (Years)</Label>
                        <Select
                          value={purchaseForm.useful_life_years}
                          onValueChange={(val) => setPurchaseForm({ ...purchaseForm, useful_life_years: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 7, 10, 15, 20].map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y} years
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Depreciation Method</Label>
                        <Select
                          value={purchaseForm.depreciation_method}
                          onValueChange={(val) => setPurchaseForm({ ...purchaseForm, depreciation_method: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="straight_line">Straight Line</SelectItem>
                            <SelectItem value="diminishing">Diminishing Balance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div id="section-funding" className="grid grid-cols-3 gap-3 items-start">
                    <div>
                      <Label>Funding Source</Label>
                      <Select
                        value={purchaseForm.funding_source}
                        onValueChange={(val) => setPurchaseForm({ ...purchaseForm, funding_source: val })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="loan">Loan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {purchaseForm.funding_source === "bank" && (
                      <div className="col-span-2">
                        <Label>Bank Account</Label>
                        <Select
                          value={purchaseForm.bank_account_id}
                          onValueChange={(val) => setPurchaseForm({ ...purchaseForm, bank_account_id: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.bank_name ? `${b.bank_name} - ${b.account_name}` : b.account_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {purchaseForm.funding_source === "loan" && (
                      <>
                        <div>
                          <Label>Loan Account</Label>
                          <Select
                            value={purchaseForm.loan_account_id}
                            onValueChange={(val) => setPurchaseForm({ ...purchaseForm, loan_account_id: val })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {loanAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.account_code} - {acc.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Interest & Term</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input className="h-9" type="number" step="0.01" placeholder="Interest %" value={purchaseForm.interest_rate} onChange={(e) => setPurchaseForm({ ...purchaseForm, interest_rate: e.target.value })} />
                            <Input className="h-9" type="number" step="1" placeholder="Term months" value={purchaseForm.loan_term} onChange={(e) => setPurchaseForm({ ...purchaseForm, loan_term: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label>Loan Term Type</Label>
                          <Select value={purchaseForm.loan_term_type} onValueChange={(val) => setPurchaseForm({ ...purchaseForm, loan_term_type: val })}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="short">Short-term</SelectItem>
                              <SelectItem value="long">Long-term</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                  <div id="section-amount-vat" className="space-y-3">
                    <div>
                      <Label>VAT Applicable?</Label>
                      <Select
                        value={purchaseForm.vat_applicable}
                        onValueChange={(val) => setPurchaseForm({ ...purchaseForm, vat_applicable: val })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes (15%)</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (R)</Label>
                      <Input
                        className="h-9"
                        type="number"
                        step="0.01"
                        value={purchaseForm.amount}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: e.target.value })}
                        required
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {purchaseForm.vat_applicable === 'yes' ? 'Amount includes VAT (15%)' : 'Amount excludes VAT'}
                      </div>
                    </div>
                  </div>
                  <div id="section-preview" className="space-y-3">
                    <div className="rounded-md border p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Accumulated Depreciation</span>
                        <span>
                          {(() => {
                            const res = calculateDepreciation(parseFloat(purchaseForm.amount || '0'), purchaseForm.purchase_date || new Date().toISOString().split('T')[0], parseInt(purchaseForm.useful_life_years || '5'));
                            return `R ${Number(res.accumulatedDepreciation || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Net Book Value</span>
                        <span>
                          {(() => {
                            const res = calculateDepreciation(parseFloat(purchaseForm.amount || '0'), purchaseForm.purchase_date || new Date().toISOString().split('T')[0], parseInt(purchaseForm.useful_life_years || '5'));
                            return `R ${Number(res.netBookValue || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div id="section-submit" className="bg-background border-t px-4 py-3">
                  <Button type="submit" className="w-full bg-gradient-primary">Submit</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* Disposal Dialog */}
          <Dialog open={disposalDialogOpen} onOpenChange={setDisposalDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dispose Fixed Asset</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDispose} className="space-y-4">
                {selectedAsset && (
                  <>
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Asset:</span>
                        <span className="text-sm">{selectedAsset.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Original Cost:</span>
                        <span className="text-sm">R {selectedAsset.cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Accumulated Depreciation:</span>
                        <span className="text-sm">R {selectedAsset.accumulated_depreciation.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-bold">Net Book Value:</span>
                        <span className="font-bold text-primary">R {calculateNetBookValue(selectedAsset).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Disposal Date</Label>
                      <Input
                        type="date"
                        value={disposalData.disposal_date}
                        onChange={(e) => setDisposalData({ ...disposalData, disposal_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Disposal Amount (R)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={disposalData.disposal_amount}
                        onChange={(e) => setDisposalData({ ...disposalData, disposal_amount: e.target.value })}
                        placeholder="Amount received from sale"
                        required
                      />
                    </div>
                    <div>
                      <Label>Asset Account (to derecognize)</Label>
                      <Select value={disposalData.asset_account_id} onValueChange={(val) => setDisposalData({ ...disposalData, asset_account_id: val })}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assetAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Bank Account (proceeds)</Label>
                      <Select value={disposalData.bank_account_id} onValueChange={(val) => setDisposalData({ ...disposalData, bank_account_id: val })}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.bank_name ? `${b.bank_name} - ${b.account_name}` : b.account_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {disposalData.disposal_amount && (
                        <p>
                          {parseFloat(disposalData.disposal_amount) > calculateNetBookValue(selectedAsset)
                            ? `Gain on disposal: R ${(parseFloat(disposalData.disposal_amount) - calculateNetBookValue(selectedAsset)).toLocaleString()}`
                            : `Loss on disposal: R ${(calculateNetBookValue(selectedAsset) - parseFloat(disposalData.disposal_amount)).toLocaleString()}`
                          }
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full bg-gradient-primary">Confirm Disposal</Button>
                  </>
                )}
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={deprDialogOpen} onOpenChange={(open) => {
            setDeprDialogOpen(open);
            if (!open) {
              setDeprSelectedAsset(null);
              setDeprAmount("");
              setDeprDebitAccountId("");
              setDeprCreditAccountId("");
              setDeprDate(new Date().toISOString().split('T')[0]);
            }
          }}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader>
                <DialogTitle>Post Depreciation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Posting Date</Label>
                  <Input type="date" value={deprDate} onChange={(e) => setDeprDate(e.target.value)} />
                </div>
                <div>
                  <Label>Select Asset</Label>
                  <Select value={deprSelectedAsset?.id || ''} onValueChange={(val) => {
                    const asset = assets.find(a => a.id === val) || null;
                    setDeprSelectedAsset(asset);
                    if (asset) {
                      const res = calculateDepreciation(Number(asset.cost||0), String(asset.purchase_date||new Date().toISOString().split('T')[0]), Number(asset.useful_life_years||5));
                      const monthly = res.annualDepreciation/12;
                      setDeprAmount(String(Number(monthly).toFixed(2)));
                      (async () => {
                        try {
                          const { data: profile } = await supabase
                            .from('profiles')
                            .select('company_id')
                            .eq('user_id', user?.id)
                            .single();
                          const companyId = (profile as any)?.company_id;
                          const { data: coas } = await supabase
                            .from('chart_of_accounts')
                            .select('id, account_code, account_name, account_type, is_active')
                            .eq('company_id', companyId)
                            .eq('is_active', true);
                          const lower = (coas||[]).map((a:any)=>({ id: String(a.id), account_code: String(a.account_code||''), account_name: String(a.account_name||'').toLowerCase(), account_type: String(a.account_type||'').toLowerCase() }));
                          const findOrCreate = async (type: 'expense'|'asset', code: string, name: string) => {
                            const found = lower.find(a => a.account_type===type && (a.account_code===code || a.account_name.includes(name.toLowerCase())));
                            if (found) return found.id;
                            const { data: created } = await supabase
                              .from('chart_of_accounts')
                              .insert({ company_id: companyId, account_code: code, account_name: name, account_type: type, is_active: true })
                              .select('id')
                              .single();
                            return String((created as any)?.id || '');
                          };
                          const depExpenseId = await findOrCreate('expense','7400','Depreciation Expense');
                          const accumDepId = await findOrCreate('asset','1540','Accumulated Depreciation');
                          setDeprDebitAccountId(depExpenseId);
                          setDeprCreditAccountId(accumDepId);
                        } catch {}
                      })();
                    }
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.filter(a => String(a.status||'active').toLowerCase()!=='disposed').map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount (Monthly)</Label>
                  <Input type="number" step="0.01" value={deprAmount} onChange={(e)=>setDeprAmount(e.target.value)} />
                </div>
                <Button
                  className="w-full bg-gradient-primary"
                  disabled={!deprSelectedAsset || !deprAmount}
                  onClick={async () => {
                    try {
                      if (!deprSelectedAsset) return;
                      const amount = parseFloat(deprAmount);
                      if (!amount || amount <= 0) {
                        toast({ title: "Invalid amount", description: "Enter a positive depreciation amount", variant: "destructive" });
                        return;
                      }
                      const { data: { user: authUser } } = await supabase.auth.getUser();
                      if (!authUser) throw new Error("Not authenticated");
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('company_id')
                        .eq('user_id', authUser.id)
                        .single();
                      const companyId = (profile as any)?.company_id;
                      if (!companyId) throw new Error("Company not found");
                      const { data: coas } = await supabase
                        .from('chart_of_accounts')
                        .select('id, account_code, account_name, account_type, is_active')
                        .eq('company_id', companyId)
                        .eq('is_active', true);
                      const monthStart = new Date(deprDate.slice(0,7) + '-01');
                      const nextMonth = new Date(monthStart);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      const monthStartStr = monthStart.toISOString().slice(0,10);
                      const nextMonthStr = nextMonth.toISOString().slice(0,10);
                      const { data: dup } = await supabase
                        .from('transactions')
                        .select('id')
                        .eq('company_id', companyId)
                        .eq('transaction_type', 'depreciation')
                        .gte('transaction_date', monthStartStr)
                        .lt('transaction_date', nextMonthStr);
                      if ((dup || []).length > 0) {
                        toast({ title: 'Duplicate depreciation', description: 'Depreciation for this month is already posted', variant: 'destructive' });
                        return;
                      }
                      const lower = (coas||[]).map((a:any)=>({ id: String(a.id), account_code: String(a.account_code||''), account_name: String(a.account_name||'').toLowerCase(), account_type: String(a.account_type||'').toLowerCase() }));
                      const findOrCreate = async (type: 'expense'|'asset', code: string, name: string) => {
                        const found = lower.find(a => a.account_type===type && (a.account_code===code || a.account_name.includes(name.toLowerCase())));
                        if (found) return found.id;
                        const { data: created } = await supabase
                          .from('chart_of_accounts')
                          .insert({ company_id: companyId, account_code: code, account_name: name, account_type: type, is_active: true })
                          .select('id')
                          .single();
                        return String((created as any)?.id || '');
                      };
                      const depExpenseId = await findOrCreate('expense','7400','Depreciation Expense');
                      const accumDepId = await findOrCreate('asset','1540','Accumulated Depreciation');

                      const description = `Depreciation - ${deprSelectedAsset.description}`;
                      const { data: tx, error: txErr } = await supabase
                        .from('transactions')
                        .insert({
                          company_id: companyId,
                          user_id: authUser.id,
                          transaction_date: deprDate,
                          description,
                          reference_number: null,
                          total_amount: amount,
                          vat_rate: null,
                          vat_amount: null,
                          base_amount: amount,
                          vat_inclusive: false,
                          bank_account_id: null,
                          transaction_type: 'depreciation',
                          status: 'pending'
                        } as any)
                        .select('id')
                        .single();
                      if (txErr) throw txErr;

                      const entries = [
                        { transaction_id: tx.id, account_id: depExpenseId, debit: amount, credit: 0, description, status: 'approved' },
                        { transaction_id: tx.id, account_id: accumDepId, debit: 0, credit: amount, description, status: 'approved' }
                      ];
                      const { error: entErr } = await supabase.from('transaction_entries').insert(entries as any);
                      if (entErr) throw entErr;

                      const ledgerRows = entries.map(e => ({
                        company_id: companyId,
                        account_id: e.account_id,
                        entry_date: deprDate,
                        description: e.description,
                        debit: e.debit,
                        credit: e.credit,
                        reference_id: tx.id,
                        transaction_id: tx.id
                      }));
                      const { error: ledErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
                      if (ledErr) throw ledErr;

                      await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);

                      const newAccum = Number(deprSelectedAsset.accumulated_depreciation || 0) + amount;
                      await updateAssetDepreciation(supabase, deprSelectedAsset.id, newAccum);

                      try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
                      toast({ title: 'Depreciation Posted', description: `${deprSelectedAsset.description} - R ${amount.toLocaleString()}` });
                      setDeprDialogOpen(false);
                      setDeprSelectedAsset(null);
                      setDeprAmount('');
                      loadAssets();
                    } catch (err:any) {
                      toast({ title: 'Failed to post depreciation', description: err.message, variant: 'destructive' });
                    }
                  }}
                >
                  Post Depreciation
                </Button>
                <Button
                  className="w-full bg-gradient-primary"
                  onClick={async () => {
                    try {
                      const { data: { user: authUser } } = await supabase.auth.getUser();
                      if (!authUser) throw new Error("Not authenticated");
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('company_id')
                        .eq('user_id', authUser.id)
                        .single();
                      const companyId = (profile as any)?.company_id;
                      if (!companyId) throw new Error("Company not found");
                      const activeAssets = assets.filter(a => String(a.status||'active').toLowerCase() !== 'disposed');
                      if (activeAssets.length === 0) {
                        toast({ title: 'No active assets', description: 'There are no assets to depreciate', variant: 'destructive' });
                        return;
                      }
                      const { data: coas } = await supabase
                        .from('chart_of_accounts')
                        .select('id, account_code, account_name, account_type, is_active')
                        .eq('company_id', companyId)
                        .eq('is_active', true);
                      const monthStart = new Date(deprDate.slice(0,7) + '-01');
                      const nextMonth = new Date(monthStart);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      const monthStartStr = monthStart.toISOString().slice(0,10);
                      const nextMonthStr = nextMonth.toISOString().slice(0,10);
                      const { data: dup } = await supabase
                        .from('transactions')
                        .select('id')
                        .eq('company_id', companyId)
                        .eq('transaction_type', 'depreciation')
                        .gte('transaction_date', monthStartStr)
                        .lt('transaction_date', nextMonthStr);
                      if ((dup || []).length > 0) {
                        toast({ title: 'Duplicate depreciation', description: 'Depreciation for this month is already posted', variant: 'destructive' });
                        return;
                      }
                      const lower = (coas||[]).map((a:any)=>({ id: String(a.id), account_code: String(a.account_code||''), account_name: String(a.account_name||'').toLowerCase(), account_type: String(a.account_type||'').toLowerCase() }));
                      const findOrCreate = async (type: 'expense'|'asset', code: string, name: string) => {
                        const found = lower.find(a => a.account_type===type && (a.account_code===code || a.account_name.includes(name.toLowerCase())));
                        if (found) return found.id;
                        const { data: created } = await supabase
                          .from('chart_of_accounts')
                          .insert({ company_id: companyId, account_code: code, account_name: name, account_type: type, is_active: true })
                          .select('id')
                          .single();
                        return String((created as any)?.id || '');
                      };
                      const depExpenseId = await findOrCreate('expense','7400','Depreciation Expense');
                      const accumDepId = await findOrCreate('asset','1540','Accumulated Depreciation');
                      const amountsById: Record<string, number> = {};
                      let total = 0;
                      activeAssets.forEach(a => {
                        const res = calculateDepreciation(Number(a.cost||0), String(a.purchase_date||new Date().toISOString().split('T')[0]), Number(a.useful_life_years||5));
                        const monthly = res.annualDepreciation/12;
                        const remaining = Math.max(0, Number(a.cost||0) - Number(a.accumulated_depreciation||0));
                        const amt = Math.min(monthly, remaining);
                        if (amt > 0) {
                          amountsById[a.id] = Number(amt.toFixed(2));
                          total += amountsById[a.id];
                        }
                      });
                      total = Number(total.toFixed(2));
                      if (!total || total <= 0) {
                        toast({ title: 'Nothing to depreciate', description: 'Monthly depreciation is zero for all assets', variant: 'destructive' });
                        return;
                      }
                      const description = 'Monthly Depreciation - All Assets';
                      const { data: tx, error: txErr } = await supabase
                        .from('transactions')
                        .insert({
                          company_id: companyId,
                          user_id: authUser.id,
                          transaction_date: deprDate,
                          description,
                          reference_number: null,
                          total_amount: total,
                          vat_rate: null,
                          vat_amount: null,
                          base_amount: total,
                          vat_inclusive: false,
                          bank_account_id: null,
                          transaction_type: 'depreciation',
                          status: 'pending'
                        } as any)
                        .select('id')
                        .single();
                      if (txErr) throw txErr;
                      const entries = [
                        { transaction_id: tx.id, account_id: depExpenseId, debit: total, credit: 0, description, status: 'approved' },
                        { transaction_id: tx.id, account_id: accumDepId, debit: 0, credit: total, description, status: 'approved' }
                      ];
                      const { error: entErr } = await supabase.from('transaction_entries').insert(entries as any);
                      if (entErr) throw entErr;
                      const ledgerRows = entries.map(e => ({
                        company_id: companyId,
                        account_id: e.account_id,
                        entry_date: deprDate,
                        description: e.description,
                        debit: e.debit,
                        credit: e.credit,
                        reference_id: tx.id,
                        transaction_id: tx.id
                      }));
                      const { error: ledErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
                      if (ledErr) throw ledErr;
                      await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);
                      for (const a of activeAssets) {
                        const inc = amountsById[a.id] || 0;
                        if (inc > 0) {
                          const newAccum = Number(a.accumulated_depreciation || 0) + inc;
                          await updateAssetDepreciation(supabase, a.id, newAccum);
                        }
                      }
                      try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
                      toast({ title: 'Depreciation Posted', description: `Total R ${total.toLocaleString()}` });
                      setDeprDialogOpen(false);
                      setDeprSelectedAsset(null);
                      setDeprAmount('');
                      loadAssets();
                    } catch (err:any) {
                      toast({ title: 'Failed to post depreciation', description: err.message, variant: 'destructive' });
                    }
                  }}
                >
                  Post Monthly Depreciation (All Assets)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
