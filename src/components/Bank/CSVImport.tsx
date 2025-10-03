import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface BankAccount {
  id: string;
  account_name: string;
}

interface CSVImportProps {
  bankAccounts: BankAccount[];
  onImportComplete: () => void;
}

export const CSVImport = ({ bankAccounts, onImportComplete }: CSVImportProps) => {
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(",");
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.trim() || "";
      });
      return row;
    });
  };

  const handleImport = async () => {
    if (!file || !selectedBank) {
      toast({ title: "Error", description: "Please select a bank account and file", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Map CSV to transactions
      const transactions = rows.map(row => {
        const amount = parseFloat(row.Amount || row.amount || "0");
        const isDebit = amount < 0;
        
        return {
          company_id: profile.company_id,
          user_id: user!.id,
          transaction_date: row.Date || row.date || new Date().toISOString().split("T")[0],
          description: row.Description || row.description || "Bank transaction",
          reference_number: row.Reference || row.reference || "",
          total_amount: Math.abs(amount),
          status: "approved",
        };
      });

      const { error } = await supabase
        .from("transactions")
        .insert(transactions);

      if (error) throw error;

      toast({ title: "Success", description: `Imported ${transactions.length} transactions` });
      setOpen(false);
      setFile(null);
      setSelectedBank("");
      onImportComplete();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "Date,Description,Reference,Amount\n2024-01-15,Sample Transaction,REF001,1500.00\n2024-01-16,Sample Payment,REF002,-750.00";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank_statement_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Bank Account</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue placeholder="Choose bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Format: Date, Description, Reference, Amount
            </p>
          </div>

          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <Button 
            onClick={handleImport} 
            disabled={importing || !file || !selectedBank}
            className="w-full bg-gradient-primary"
          >
            {importing ? "Importing..." : "Import Transactions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
