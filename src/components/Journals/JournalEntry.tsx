import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, FileText, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Check, ChevronsUpDown, History } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface JournalLine {
  id: string;
  accountId: string;
  description: string;
  debit: number;
  credit: number;
}

interface AccountComboboxProps {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
}

const AccountCombobox = ({ accounts, value, onChange }: AccountComboboxProps) => {
  const [open, setOpen] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between hover:bg-muted/50 font-normal pl-2 h-9 text-left"
        >
          {selectedAccount ? (
             <span className="truncate flex items-center">
                <span className="font-mono text-muted-foreground mr-2">{selectedAccount.account_code}</span>
                {selectedAccount.account_name}
             </span>
          ) : (
            <span className="text-muted-foreground">Select Account...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search account code or name..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`${account.account_code} ${account.account_name}`}
                  onSelect={() => {
                    onChange(account.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-mono text-muted-foreground mr-2 w-16">{account.account_code}</span>
                  <span>{account.account_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const JournalEntry = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [view, setView] = useState<'entry' | 'history'>('entry');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [journals, setJournals] = useState<Array<{
    id: string;
    transaction_date: string;
    reference_number: string | null;
    description: string;
    total_amount: number;
    status: string;
  }>>([]);
  
  // Header state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  
  // Lines state
  const [lines, setLines] = useState<JournalLine[]>([
    { id: "1", accountId: "", description: "", debit: 0, credit: 0 },
    { id: "2", accountId: "", description: "", debit: 0, credit: 0 },
  ]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single();
      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Failed to load accounts");
      console.error(error);
    }
  };

  const addLine = () => {
    setLines([...lines, { 
      id: Math.random().toString(36).substr(2, 9), 
      accountId: "", 
      description: description || "", 
      debit: 0, 
      credit: 0 
    }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.warning("Journal must have at least 2 lines");
      return;
    }
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof JournalLine, value: any) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      const updates = { ...l, [field]: value };
      
      // If debit is entered, clear credit and vice versa
      if (field === 'debit' && Number(value) > 0) updates.credit = 0;
      if (field === 'credit' && Number(value) > 0) updates.debit = 0;
      
      return updates;
    }));
  };

  const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01;

  const loadJournalHistory = async () => {
    try {
      if (!user) return;
      setHistoryLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.company_id) {
        setJournals([]);
        return;
      }
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, reference_number, description, total_amount, status")
        .eq("company_id", profile.company_id)
        .eq("transaction_type", "journal")
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      setJournals((data || []) as any);
    } catch (error: any) {
      toast.error(error.message || "Failed to load journal history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (view === "history") loadJournalHistory();
  }, [view, user]);

  const handlePost = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    if (!description) {
      toast.error("Please enter a description");
      return;
    }
    if (lines.some(l => !l.accountId)) {
      toast.error("All lines must have an account selected");
      return;
    }
    if (!isBalanced) {
      toast.error("Journal is not balanced");
      return;
    }
    if (totalDebits === 0) {
      toast.error("Journal cannot be zero");
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', user!.id).single();
      if (!profile?.company_id) throw new Error("Company not found");

      // Create Transaction Header
      const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
          company_id: profile.company_id,
          transaction_date: date,
          description,
          reference_number: reference || `JNL-${format(new Date(), 'yyyyMMddHHmmss')}`,
          total_amount: totalDebits,
          transaction_type: "journal",
          status: "posted",
          user_id: user!.id
        })
        .select()
        .single();

      if (transError) throw transError;

      // Create Entries
      const entries = lines.map(line => ({
        transaction_id: transaction.id,
        account_id: line.accountId,
        description: line.description || description,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        status: "approved"
      }));

      const { error: entriesError } = await supabase
        .from('transaction_entries')
        .insert(entries);

      if (entriesError) throw entriesError;

      toast.success("Journal posted successfully");
      
      // Reset form
      setReference("");
      setDescription("");
      setLines([
        { id: "1", accountId: "", description: "", debit: 0, credit: 0 },
        { id: "2", accountId: "", description: "", debit: 0, credit: 0 },
      ]);
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to post journal");
    } finally {
      setLoading(false);
    }
  };

  if (view === "history") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Journal History
            </h1>
            <p className="text-muted-foreground mt-1">Review posted journal transactions</p>
          </div>
          <Button variant="outline" onClick={() => setView("entry")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Entry
          </Button>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="bg-muted/10 pb-6 border-b">
            <CardTitle>Recent Journals</CardTitle>
            <CardDescription>Last 50 journal transactions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            ) : journals.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <div className="font-medium">No journals found</div>
                <div className="text-sm">Post a journal entry to see it here.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journals.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell>{new Date(j.transaction_date).toLocaleDateString("en-ZA")}</TableCell>
                        <TableCell className="font-mono">{j.reference_number || "-"}</TableCell>
                        <TableCell className="max-w-[520px] truncate">{j.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(j.total_amount || 0).toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}
                        </TableCell>
                        <TableCell className="capitalize">{String(j.status || "-")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Journal Entry
          </h1>
          <p className="text-muted-foreground mt-1">Record general journal entries and adjustments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('history')} className="gap-2">
            <History className="h-4 w-4" /> View History
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="bg-muted/10 pb-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input 
                placeholder="e.g. JNL-001" 
                value={reference} 
                onChange={(e) => setReference(e.target.value)}
                className="bg-background" 
              />
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="e.g. Monthly Depreciation" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background" 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[30%]">Account <span className="text-red-500">*</span></TableHead>
                  <TableHead className="w-[30%]">Description</TableHead>
                  <TableHead className="w-[15%] text-right">Debit</TableHead>
                  <TableHead className="w-[15%] text-right">Credit</TableHead>
                  <TableHead className="w-[10%] text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id} className="group hover:bg-muted/5">
                    <TableCell>
                      <AccountCombobox 
                        accounts={accounts}
                        value={line.accountId}
                        onChange={(val) => updateLine(line.id, 'accountId', val)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={line.description} 
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                        placeholder={description}
                        className="border-transparent focus:border-primary hover:bg-muted/50 bg-transparent"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={line.debit || ''} 
                        onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                        className="text-right border-transparent focus:border-primary hover:bg-muted/50 bg-transparent font-mono"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={line.credit || ''} 
                        onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                        className="text-right border-transparent focus:border-primary hover:bg-muted/50 bg-transparent font-mono"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeLine(line.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5}>
                    <Button variant="ghost" onClick={addLine} className="text-primary hover:text-primary/80 gap-2 pl-0 hover:bg-transparent">
                      <Plus className="h-4 w-4" /> Add Line
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
        
        {/* Footer Totals */}
        <div className="border-t bg-muted/10 p-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              {!isBalanced ? (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Out of Balance: {Math.abs(difference).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium text-sm">Balanced</span>
                </div>
              )}
            </div>

            <div className="flex gap-8 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground text-xs uppercase font-semibold">Total Debits</span>
                <span className="font-mono text-lg font-medium">{totalDebits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground text-xs uppercase font-semibold">Total Credits</span>
                <span className="font-mono text-lg font-medium">{totalCredits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6 pt-6 border-t">
            <Button 
              size="lg" 
              className="gap-2 min-w-[150px] shadow-lg shadow-primary/20" 
              onClick={handlePost} 
              disabled={loading || !isBalanced || totalDebits === 0}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Post Journal
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
