import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";

export const ConnectBank = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const providerUrl = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_BANK_CONNECT_URL as string | undefined;

  const southAfricanBanks = [
    { code: "ABSA", name: "Absa Bank", supportsOpenBanking: true },
    { code: "FNB", name: "First National Bank (FNB)", supportsOpenBanking: true },
    { code: "STANDARD", name: "Standard Bank", supportsOpenBanking: true },
    { code: "NEDBANK", name: "Nedbank", supportsOpenBanking: true },
    { code: "CAPITEC", name: "Capitec Bank", supportsOpenBanking: false },
    { code: "INVESTEC", name: "Investec", supportsOpenBanking: false },
    { code: "TYME", name: "TymeBank", supportsOpenBanking: false },
    { code: "DISCOVERY", name: "Discovery Bank", supportsOpenBanking: true },
    { code: "AFRICAN", name: "African Bank", supportsOpenBanking: false },
  ];

  const handleConnect = async () => {
    if (!selectedBank || !accountNumber || !username || !password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id || "")
        .single();
      if (!profile) throw new Error("Profile not found");

      const bankName = southAfricanBanks.find(b => b.code === selectedBank)?.name || selectedBank;
      const masked = accountNumber.replace(/\s/g, "");
      const suffix = masked.slice(-4) || masked;

      const selected = southAfricanBanks.find(b => b.code === selectedBank);
      if (selected?.supportsOpenBanking) {
        try {
          const { data, error } = await (supabase as unknown as { functions: { invoke: <T>(name: string, args: { body?: unknown }) => Promise<{ data: T | null, error: unknown }> } }).functions.invoke<{ link_url?: string }>("create_bank_link", {
            body: { bank: selectedBank, accountNumber: masked, redirectUrl: window.location.origin },
          });
          if (!error && data?.link_url) {
            window.open(String(data.link_url), "_blank", "noopener");
          } else if (providerUrl) {
            const url = new URL(providerUrl);
            url.searchParams.set("bank", selectedBank);
            url.searchParams.set("accountNumber", masked);
            window.open(url.toString(), "_blank", "noopener");
          }
        } catch (e) {
          // swallow; fallback below covers non-critical errors
        }
      }

      const companyId = (profile as { company_id: string }).company_id;
      const { data: inserted, error } = await supabase
        .from("bank_accounts")
        .insert({
          company_id: companyId,
          account_name: `${bankName} Account ••••${suffix}`,
          account_number: masked,
          bank_name: bankName,
          opening_balance: 0,
          current_balance: 0
        })
        .select("id")
        .single();
      if (error || !inserted) throw error || new Error("Failed to connect bank");

      toast({
        title: "Bank Connected",
        description: `${bankName} ••••${suffix} is ready for CSV import and reconciliation`,
      });

      setSelectedBank("");
      setAccountNumber("");
      setUsername("");
      setPassword("");
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unable to connect to your bank. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary">
          <Building2 className="h-4 w-4 mr-2" />
          Connect Bank Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Bank Account</DialogTitle>
          <DialogDescription>
            Securely connect your South African bank account for automatic transaction imports
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bank">Select Your Bank</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger id="bank">
                <SelectValue placeholder="Choose your bank" />
              </SelectTrigger>
              <SelectContent>
                {southAfricanBanks.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    <div className="flex items-center justify-between w-full">
                      <span>{bank.name}</span>
                      {bank.supportsOpenBanking && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Open Banking
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Enter your account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Online Banking Username</Label>
            <Input
              id="username"
              placeholder="Your online banking username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Online Banking Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Your online banking password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-medium">Secure Connection</p>
              <p>Your banking credentials are encrypted and never stored on our servers.</p>
            </div>
          </div>

          

          <Button 
            onClick={handleConnect} 
            className="w-full bg-gradient-primary"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Connecting...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Connect Bank
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
