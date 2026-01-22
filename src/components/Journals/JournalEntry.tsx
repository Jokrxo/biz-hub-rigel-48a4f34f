import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronsUpDown, FileText, History, Loader2, Plus, Save, X, Wallet, CreditCard, Scale, Calendar, Hash, Info } from "lucide-react";
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
             <span className="truncate flex items-center gap-2">
                <span className="font-mono font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{selectedAccount.account_code}</span>
                <span className="truncate">{selectedAccount.account_name}</span>
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
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-mono text-muted-foreground mr-2 w-16">{account.account_code}</span>
                  <span className="flex-1 truncate">{account.account_name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2 capitalize">{account.account_type}</span>
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

    // Auto-fill description from first line if main description is empty
    let submitDescription = description;
    if (!submitDescription) {
      const firstLineDesc = lines.find(l => l.description?.trim())?.description;
      if (firstLineDesc) {
        submitDescription = firstLineDesc;
        setDescription(firstLineDesc); // Update UI
      } else {
        toast.error("Please enter a description for the journal document");
        return;
      }
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

      // Create Transaction Header as DRAFT first to avoid "no entries" trigger error
      const { data: transaction, error: transError } = await supabase
        .from('transactions')
        .insert({
          company_id: profile.company_id,
          transaction_date: date,
          description: submitDescription,
          reference_number: reference || `JNL-${format(new Date(), 'yyyyMMddHHmmss')}`,
          total_amount: totalDebits,
          transaction_type: "journal",
          status: "draft", // Start as draft
          user_id: user!.id
        })
        .select()
        .single();

      if (transError) throw transError;

      // Create Entries
      const entries = lines.map(line => ({
        transaction_id: transaction.id,
        account_id: line.accountId,
        description: line.description || submitDescription,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        status: "approved"
      }));

      const { error: entriesError } = await supabase
        .from('transaction_entries')
        .insert(entries);

      if (entriesError) throw entriesError;

      // Update status to POSTED to trigger the ledger posting
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'posted' })
        .eq('id', transaction.id);

      if (updateError) throw updateError;

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
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto">
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

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
         <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Debits</CardTitle>
              <Wallet className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{totalDebits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</div>
              <p className="text-xs text-muted-foreground mt-1">Sum of all debit lines</p>
            </CardContent>
         </Card>

         <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{totalCredits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</div>
              <p className="text-xs text-muted-foreground mt-1">Sum of all credit lines</p>
            </CardContent>
         </Card>

         <Card className={cn("border-none shadow-md bg-gradient-to-br to-background transition-colors", 
            isBalanced ? "from-emerald-500/10 via-emerald-500/5" : "from-red-500/10 via-red-500/5"
         )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              <Scale className={cn("h-5 w-5", isBalanced ? "text-emerald-600" : "text-red-600")} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", isBalanced ? "text-emerald-700" : "text-red-700")}>
                {isBalanced ? "Balanced" : "Unbalanced"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isBalanced ? "Ready to post" : `Difference: ${Math.abs(difference).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}`}
              </p>
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Header Panel */}
        <Card className="lg:col-span-3 h-fit border shadow-sm">
           <CardHeader className="bg-muted/10 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                 <FileText className="h-4 w-4 text-primary" />
                 Document Details
              </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Date <span className="text-red-500">*</span></Label>
                <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input 
                     type="date" 
                     value={date} 
                     onChange={(e) => setDate(e.target.value)} 
                     className="pl-9 bg-background"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Reference</Label>
                <div className="relative">
                   <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Auto-generated if empty" 
                     value={reference} 
                     onChange={(e) => setReference(e.target.value)}
                     className="pl-9 bg-background" 
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Document Description <span className="text-red-500">*</span></Label>
                <div className="relative">
                   <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                   <textarea 
                     className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9 resize-none"
                     placeholder="Overall journal description (e.g. Monthly Salaries)" 
                     value={description} 
                     onChange={(e) => setDescription(e.target.value)}
                   />
                </div>
                <p className="text-[10px] text-muted-foreground">This description will be used for the main transaction record.</p>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  size="lg" 
                  className="w-full gap-2 shadow-lg shadow-primary/20 bg-gradient-primary" 
                  onClick={handlePost} 
                  disabled={loading || !isBalanced || totalDebits === 0}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Post Journal
                </Button>
                {!isBalanced && (
                   <p className="text-xs text-center text-red-500 mt-2 font-medium">Journal must be balanced to post</p>
                )}
              </div>
           </CardContent>
        </Card>

        {/* Entries Table Panel */}
        <Card className="lg:col-span-9 border shadow-sm">
          <CardHeader className="bg-muted/10 border-b pb-4 flex flex-row items-center justify-between">
            <div>
               <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Journal Entries
               </CardTitle>
               <CardDescription>Add at least 2 lines (debit and credit)</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
               {lines.length} lines
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[35%] pl-4">Account <span className="text-red-500">*</span></TableHead>
                    <TableHead className="w-[25%]">Description</TableHead>
                    <TableHead className="w-[15%] text-right">Debit</TableHead>
                    <TableHead className="w-[15%] text-right">Credit</TableHead>
                    <TableHead className="w-[10%] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} className="group hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-4">
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
                          placeholder={description || "Line description"}
                          className="border-transparent focus:border-primary hover:bg-muted/50 bg-transparent h-9"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={line.debit || ''} 
                          onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                          className="text-right border-transparent focus:border-primary hover:bg-muted/50 bg-transparent font-mono h-9"
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
                          className="text-right border-transparent focus:border-primary hover:bg-muted/50 bg-transparent font-mono h-9"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeLine(line.id)}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remove line"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-transparent border-t-0">
                    <TableCell colSpan={5} className="p-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={addLine} 
                        className="w-full border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 gap-2"
                      >
                        <Plus className="h-4 w-4" /> Add New Line
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <div className="bg-muted/10 p-4 border-t flex justify-end gap-6 text-sm">
             <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Total Debits:</span>
                <span className="font-mono font-bold">{totalDebits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Total Credits:</span>
                <span className="font-mono font-bold">{totalCredits.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
