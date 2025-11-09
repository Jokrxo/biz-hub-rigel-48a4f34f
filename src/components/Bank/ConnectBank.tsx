import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface ConnectBankProps {
  companyId?: string;
}

// South Africa institutions (sample). Real coverage depends on provider configuration.
const institutions = [
  { id: "absa", name: "Absa" },
  { id: "fnb", name: "FNB (First National Bank)" },
  { id: "standard_bank", name: "Standard Bank" },
  { id: "nedbank", name: "Nedbank" },
  { id: "capitec", name: "Capitec" },
  { id: "investec", name: "Investec" },
];

export const ConnectBank = ({ companyId }: ConnectBankProps) => {
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | undefined>(companyId);
  const { toast } = useToast();

  useEffect(() => {
    const resolveCompany = async () => {
      if (companyId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (profile?.company_id) {
        setResolvedCompanyId(profile.company_id);
      }
    };
    resolveCompany();
  }, [companyId]);

  const startLink = async () => {
    try {
      if (!resolvedCompanyId) {
        toast({ title: "Missing company", description: "Could not resolve company", variant: "destructive" });
        return;
      }
      if (!institution) {
        toast({ title: "Select a bank", description: "Please select a bank to connect" });
        return;
      }
      setLinking(true);
      const { data, error } = await supabase.functions.invoke("stitch-link", {
        body: { company_id: resolvedCompanyId, institution_id: institution },
      });
      if (error) throw error;

      const linkUrl = (data as any)?.link_url;
      if (!linkUrl) {
        toast({ title: "Link failed", description: "No link URL returned", variant: "destructive" });
        return;
      }
      window.open(linkUrl, "_blank");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start bank linking", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Connect Bank</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a Bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Bank</Label>
            <Select value={institution} onValueChange={setInstitution}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a bank" />
              </SelectTrigger>
              <SelectContent>
                {institutions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={startLink} disabled={linking || !institution} className="w-full bg-gradient-primary">
            {linking ? "Starting..." : "Start Linking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};