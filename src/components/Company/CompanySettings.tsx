import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface CompanyData {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  default_currency: string;
  business_type?: string;
  tax_number?: string;
  vat_number?: string;
}

export const CompanySettings = () => {
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    default_currency: "ZAR",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .single();

      if (error) throw error;
      if (data) setCompanyData(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const { error } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", profile!.company_id);

      if (error) throw error;

      toast({ title: "Success", description: "Company details updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Company Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={companyData.name}
              onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Company Code</Label>
            <Input
              value={companyData.code}
              onChange={(e) => setCompanyData({ ...companyData, code: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={companyData.email || ""}
              onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={companyData.phone || ""}
              onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Address</Label>
          <Input
            value={companyData.address || ""}
            onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Business Type</Label>
            <Select
              value={companyData.business_type || ""}
              onValueChange={(val) => setCompanyData({ ...companyData, business_type: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="pty_ltd">Pty Ltd</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="npo">NPO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <Select
              value={companyData.default_currency}
              onValueChange={(val) => setCompanyData({ ...companyData, default_currency: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tax Number</Label>
            <Input
              value={companyData.tax_number || ""}
              onChange={(e) => setCompanyData({ ...companyData, tax_number: e.target.value })}
              placeholder="Tax registration number"
            />
          </div>
          <div>
            <Label>VAT Number</Label>
            <Input
              value={companyData.vat_number || ""}
              onChange={(e) => setCompanyData({ ...companyData, vat_number: e.target.value })}
              placeholder="VAT registration number"
            />
          </div>
        </div>

        <Button onClick={handleSave} className="w-full bg-gradient-primary">
          <Save className="h-4 w-4 mr-2" />
          Save Company Details
        </Button>
      </CardContent>
    </Card>
  );
};
