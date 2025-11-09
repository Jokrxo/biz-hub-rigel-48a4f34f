import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ConnectBank = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

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
      // Simulate bank connection process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "Bank Connected Successfully",
        description: `Your ${southAfricanBanks.find(b => b.code === selectedBank)?.name} account has been connected.`,
      });
      
      // Reset form
      setSelectedBank("");
      setAccountNumber("");
      setUsername("");
      setPassword("");
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Unable to connect to your bank. Please try again.",
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

          <div className="flex items-start space-x-2 p-3 bg-amber-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">Demo Mode</p>
              <p>This is a demonstration. In production, this would use secure bank APIs.</p>
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