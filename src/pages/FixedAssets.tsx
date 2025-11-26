import { useState, useEffect } from "react";
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
import { Plus, Download, Trash2, Package, Search, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { calculateDepreciation } from "@/components/FixedAssets/DepreciationCalculator";

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
  const [loanAccounts, setLoanAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disposalDialogOpen, setDisposalDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
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

  useEffect(() => {
    loadAssets();
  }, []);

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
    const bankCandidate = assetAccounts.find(a => a.account_name.toLowerCase().includes('bank'));
    setDisposalData(prev => ({
      ...prev,
      asset_account_id: (byName?.id || byToken?.id || byCode?.id || prev.asset_account_id || ''),
      bank_account_id: (bankCandidate?.id || prev.bank_account_id || '')
    }));
  }, [selectedAsset, assetAccounts]);

  const loadAssets = async () => {
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

      // Load fixed asset accounts for posting selection
      const { data: faAccounts } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, is_active")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .eq("account_type", "asset")
        .order("account_code");
      const mapped = (faAccounts || []).map((a: any) => ({ id: String(a.id), account_code: String(a.account_code || ''), account_name: String(a.account_name || '') }));
      setAssetAccounts(mapped);
      if (!formData.asset_account_id && mapped.length > 0) {
        setFormData(prev => ({ ...prev, asset_account_id: mapped[0].id }));
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
      const bankCandidate = mapped.find(a => a.account_name.toLowerCase().includes('bank'));
      if (!formData.bank_account_id && bankCandidate) {
        setFormData(prev => ({ ...prev, bank_account_id: bankCandidate.id }));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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

      const { error } = await supabase.from("fixed_assets").insert({
        company_id: profile!.company_id,
        description: `${formData.description} [method:${formData.depreciation_method}]`,
        cost: parseFloat(formData.cost),
        purchase_date: formData.purchase_date,
        useful_life_years: parseInt(formData.useful_life_years),
        accumulated_depreciation: 0,
        status: "active",
      });

      if (error) throw error;

      try {
        const costNum = parseFloat(formData.cost);
        // Use selected asset account, fallback to heuristic
        let assetAccountId = formData.asset_account_id;
        if (!assetAccountId) {
          const { data: assetAccs } = await supabase
            .from("chart_of_accounts")
            .select("id, account_code, account_name")
            .eq("company_id", profile!.company_id)
            .eq("is_active", true);
          const assetAccount = (assetAccs || []).find(a => String(a.account_code || '').startsWith('15') || String(a.account_name || '').toLowerCase().includes('fixed asset'));
          assetAccountId = String(assetAccount?.id || "");
        }
        const creditAccountId = formData.funding_source === 'loan' ? formData.loan_account_id : formData.bank_account_id;
        if (assetAccountId && creditAccountId && costNum > 0) {
          const basePayload: any = {
            company_id: profile!.company_id,
            user_id: user!.id,
            transaction_date: formData.purchase_date,
            description: `Asset Purchase - ${formData.description} [method:${formData.depreciation_method}]`,
            reference_number: null,
            total_amount: costNum,
            bank_account_id: null,
            status: "pending"
          };
          let txId: string | null = null;
          try {
            const { data: tx } = await supabase
              .from("transactions" as any)
              .insert({ ...basePayload, transaction_type: "asset" } as any)
              .select("id")
              .single();
            txId = tx?.id || null;
          } catch (err: any) {
            const msg = String(err?.message || '').toLowerCase();
            const retry = msg.includes('column') && msg.includes('does not exist');
            if (!retry) throw err;
            const { data: tx2 } = await supabase
              .from("transactions" as any)
              .insert(basePayload as any)
              .select("id")
              .single();
            txId = tx2?.id || null;
          }
          if (txId) {
            const entries = [
              { transaction_id: txId, account_id: assetAccountId as string, debit: costNum, credit: 0, description: `Asset Purchase - ${formData.description}`, status: 'approved' },
              { transaction_id: txId, account_id: creditAccountId as string, debit: 0, credit: costNum, description: `Asset Purchase - ${formData.description}`, status: 'approved' }
            ];
            const { error: entErr } = await supabase.from("transaction_entries").insert(entries as any);
            if (!entErr) {
              await supabase.from("transactions").update({ status: 'approved' }).eq("id", txId);
            }
          }
        }
      } catch {}

      toast({ title: "Success", description: "Fixed asset added successfully" });
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
    const params = new URLSearchParams({
      flow: 'asset_disposal',
      asset_id: String(selectedAsset.id),
      date: disposalData.disposal_date,
      amount: String(disposalAmount || ''),
      bank_id: disposalData.bank_account_id || '',
      asset_account_id: disposalData.asset_account_id || '',
      description: `Asset Disposal - ${selectedAsset.description}`
    });
    navigate(`/transactions?${params.toString()}`);
    setDisposalDialogOpen(false);
    setSelectedAsset(null);
    setDisposalData({ 
      disposal_date: new Date().toISOString().split("T")[0], 
      disposal_amount: "", 
      asset_account_id: disposalData.asset_account_id || "", 
      bank_account_id: disposalData.bank_account_id || "" 
    });
  };

  const canEdit = isAdmin || isAccountant;

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
              <Button variant="outline" disabled={assets.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
              {canEdit && (
                <Button variant="outline" onClick={async () => {
                  try {
                    const { data: profile } = await supabase
                      .from("profiles")
                      .select("company_id")
                      .eq("user_id", user?.id)
                      .single();
                    
                    const { data, error } = await supabase.rpc('post_monthly_depreciation', { 
                      _company_id: profile!.company_id, 
                      _posting_date: new Date().toISOString().split('T')[0] 
                    });
                    
                    if (error) {
                      toast({ title: "Depreciation Failed", description: error.message, variant: "destructive" });
                    } else if (data && Array.isArray(data)) {
                      const successfulEntries = data.filter(item => !item.error_message);
                      const errorEntries = data.filter(item => item.error_message);
                      
                      if (errorEntries.length > 0) {
                        toast({ 
                          title: "Depreciation Partially Completed", 
                          description: `${successfulEntries.length} assets processed, ${errorEntries.length} errors`, 
                          variant: "destructive" 
                        });
                      } else {
                        toast({ 
                          title: "Depreciation Posted Successfully", 
                          description: `Processed ${successfulEntries.length} assets` 
                        });
                      }
                      
                      loadAssets();
                    } else {
                      toast({ title: "No Assets Processed", description: "No active assets found for depreciation" });
                    }
                  } catch (err) {
                    toast({ title: "Error", description: "Failed to post depreciation", variant: "destructive" });
                  }
                }}>Post Monthly Depreciation</Button>
              )}
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Asset
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[560px] p-4">
                    <DialogHeader>
                      <DialogTitle>Add Fixed Asset</DialogTitle>
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
                      <div>
                        <Label>Funding Source</Label>
                        <Select value={formData.funding_source} onValueChange={(val) => setFormData({ ...formData, funding_source: val })}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank">Bank</SelectItem>
                            <SelectItem value="loan">Loan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.funding_source === 'bank' && (
                        <div>
                          <Label>Bank Account</Label>
                          <Select value={formData.bank_account_id} onValueChange={(val) => setFormData({ ...formData, bank_account_id: val })}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assetAccounts.filter(a => a.account_name.toLowerCase().includes('bank')).map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.funding_source === 'loan' && (
                        <div>
                          <Label>Loan Account</Label>
                          <Select value={formData.loan_account_id} onValueChange={(val) => setFormData({ ...formData, loan_account_id: val })}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {loanAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button type="submit" className="w-full bg-gradient-primary">Add Asset</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Asset Register
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.description}</TableCell>
                        <TableCell>{new Date(asset.purchase_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">R {asset.cost.toLocaleString()}</TableCell>
                        <TableCell className="text-right">R {asset.accumulated_depreciation.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">R {calculateNetBookValue(asset).toLocaleString()}</TableCell>
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
                                const bankCandidate = assetAccounts.find(a => a.account_name.toLowerCase().includes('bank'));
                                setDisposalData(prev => ({
                                  ...prev,
                                  asset_account_id: (byName?.id || prev.asset_account_id || ''),
                                  bank_account_id: (bankCandidate?.id || prev.bank_account_id || '')
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
                <p>To add existing opening assets, use the Add Asset button in this module.</p>
                <p>To post monthly depreciation, use the Post Monthly Depreciation button. Depreciation reduces book value and appears in reports.</p>
                <p>To dispose assets, use the dispose action; proceeds post to Bank, and the system records gain or loss automatically.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </DialogFooter>
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
                          {assetAccounts.filter(a => a.account_name.toLowerCase().includes('bank')).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
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
        </div>
      </DashboardLayout>
    </>
  );
}
