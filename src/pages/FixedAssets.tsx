import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    description: "",
    cost: "",
    purchase_date: "",
    useful_life_years: "5",
  });

  useEffect(() => {
    loadAssets();
  }, []);

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
      
      // Auto-calculate depreciation for each asset
      const assetsWithDepreciation = (data || []).map(asset => {
        const depreciation = calculateDepreciation(
          asset.cost,
          asset.purchase_date,
          asset.useful_life_years
        );
        return {
          ...asset,
          accumulated_depreciation: depreciation.accumulatedDepreciation,
        };
      });
      
      setAssets(assetsWithDepreciation);
      
      // Update depreciation in database
      for (const asset of assetsWithDepreciation) {
        if (asset.accumulated_depreciation !== data?.find(a => a.id === asset.id)?.accumulated_depreciation) {
          await supabase
            .from("fixed_assets")
            .update({ accumulated_depreciation: asset.accumulated_depreciation })
            .eq("id", asset.id);
        }
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
        description: formData.description,
        cost: parseFloat(formData.cost),
        purchase_date: formData.purchase_date,
        useful_life_years: parseInt(formData.useful_life_years),
        accumulated_depreciation: 0,
        status: "active",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Fixed asset added successfully" });
      setDialogOpen(false);
      setFormData({ description: "", cost: "", purchase_date: "", useful_life_years: "5" });
      loadAssets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const calculateNetBookValue = (asset: FixedAsset) => {
    return asset.cost - asset.accumulated_depreciation;
  };

  const canEdit = isAdmin || isAccountant;

  return (
    <>
      <SEO title="Fixed Assets Register | ApexAccounts" description="Manage fixed assets and depreciation" />
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
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Asset
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Fixed Asset</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>Description</Label>
                        <Input
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="e.g., Office Equipment"
                          required
                        />
                      </div>
                      <div>
                        <Label>Cost (R)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cost}
                          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Purchase Date</Label>
                        <Input
                          type="date"
                          value={formData.purchase_date}
                          onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Useful Life (Years)</Label>
                        <Select value={formData.useful_life_years} onValueChange={(val) => setFormData({ ...formData, useful_life_years: val })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 7, 10, 15, 20].map((years) => (
                              <SelectItem key={years} value={years.toString()}>{years} years</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
