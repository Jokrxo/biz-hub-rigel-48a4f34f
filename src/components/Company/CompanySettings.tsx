import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, Upload, Image as ImageIcon, Mail, Phone, MapPin, Tag, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { toast as notify } from "sonner";
import { useAuth } from "@/context/useAuth";

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
  bank_name?: string;
  account_holder?: string;
  branch_code?: string;
  account_number?: string;
}

export const CompanySettings = () => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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

  const loadCompanyData = useCallback(async () => {
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
      if (data) { setCompanyData(data); setLogoUrl(data.logo_url); }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [user?.id, toast]);
  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      
      setUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Update company with logo URL
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", profile.company_id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      notify.success("Logo uploaded", { description: "Your company logo has been updated", duration: 5000 });
    } catch (error: any) {
      notify.error("Logo upload failed", { description: error.message, duration: 6000 });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Only update fields that exist in the companies table
      const updateData: any = {
        name: companyData.name,
        code: companyData.code,
        email: companyData.email || null,
        phone: companyData.phone || null,
        address: companyData.address || null,
      };

      // Add optional fields if they exist in the table
      if (companyData.default_currency) {
        updateData.default_currency = companyData.default_currency;
      }
      if (companyData.business_type) {
        updateData.business_type = companyData.business_type;
      }
      if (companyData.tax_number) {
        updateData.tax_number = companyData.tax_number;
      }
      if (companyData.vat_number) {
        updateData.vat_number = companyData.vat_number;
      }
      if (companyData.bank_name) updateData.bank_name = companyData.bank_name;
      if (companyData.account_holder) updateData.account_holder = companyData.account_holder;
      if (companyData.branch_code) updateData.branch_code = companyData.branch_code;
      if (companyData.account_number) updateData.account_number = companyData.account_number;

      const { error } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", profile.company_id);

      if (error) throw error;

      // Reload company data to show updated information
      await loadCompanyData();

      notify.success("Company details saved", { description: "Your changes have been applied", duration: 5000 });
    } catch (error: any) {
      notify.error("Update failed", { description: error.message, duration: 6000 });
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Company Information Display Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Company Overview
            </CardTitle>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="w-16 h-16 rounded-full ring-2 ring-primary/40 shadow-sm overflow-hidden">
                  <img src={logoUrl} alt="Company Logo" loading="lazy" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full ring-2 ring-primary/30 bg-muted flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
              <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Change Logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Company Name</div>
                <div className="text-sm font-semibold">{companyData.name || "Not set"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
              <Tag className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Company Code</div>
                <div className="text-sm font-semibold">{companyData.code || "Not set"}</div>
              </div>
            </div>
            {companyData.email && (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm font-semibold">{companyData.email}</div>
                </div>
              </div>
            )}
            {companyData.phone && (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="text-sm font-semibold">{companyData.phone}</div>
                </div>
              </div>
            )}
            {companyData.address && (
              <div className="md:col-span-2 flex items-center gap-3 p-3 rounded-md border bg-background/50">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div className="text-sm font-semibold">{companyData.address}</div>
                </div>
              </div>
            )}
            {companyData.business_type && (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Business Type</div>
                  <div className="text-sm font-semibold capitalize px-2 py-1 rounded bg-primary/10 text-primary inline-block">{companyData.business_type.replace('_', ' ')}</div>
                </div>
              </div>
            )}
            {companyData.default_currency && (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-background/50">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Currency</div>
                  <div className="text-sm font-semibold px-2 py-1 rounded bg-primary/10 text-primary inline-block">{companyData.default_currency}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Settings Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Company Settings
            </CardTitle>
            <Button variant="outline" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit"}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
        {editing ? (
        <>
        <div className="space-y-4">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                <img src={logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Upload your company logo (PNG, JPG, max 2MB)
              </p>
            </div>
          </div>
        </div>

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

        <div className="pt-4 border-t">
          <Label className="text-lg font-semibold mb-4 block">Banking Details (For Invoices)</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input
                value={companyData.bank_name || ""}
                onChange={(e) => setCompanyData({ ...companyData, bank_name: e.target.value })}
                placeholder="e.g. FNB, Standard Bank"
              />
            </div>
            <div>
              <Label>Account Holder</Label>
              <Input
                value={companyData.account_holder || ""}
                onChange={(e) => setCompanyData({ ...companyData, account_holder: e.target.value })}
                placeholder="Account holder name"
              />
            </div>
            <div>
              <Label>Branch Code</Label>
              <Input
                value={companyData.branch_code || ""}
                onChange={(e) => setCompanyData({ ...companyData, branch_code: e.target.value })}
                placeholder="Universal or branch code"
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                value={companyData.account_number || ""}
                onChange={(e) => setCompanyData({ ...companyData, account_number: e.target.value })}
                placeholder="Bank account number"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full bg-gradient-primary">
          <Save className="h-4 w-4 mr-2" />
          Save Company Details
        </Button>
        </>
        ) : (
          <div className="text-sm text-muted-foreground">Press Edit to modify company settings.</div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};
