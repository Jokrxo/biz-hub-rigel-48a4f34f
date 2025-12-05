import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transactionsApi } from "@/lib/transactions-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  cost_price?: number;
  quantity_on_hand: number;
  item_type: string;
}

export const SalesProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();
  const canEdit = isAdmin || isAccountant;
  const [companyId, setCompanyId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    unit_price: "",
    cost_price: ""
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_price: "",
    cost_price: "",
    quantity_on_hand: "",
  });

  const loadProducts = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!profile) return;
      setCompanyId(profile.company_id as string);
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "product")
        .order("name");
      if (error) throw error;
      setProducts(data || []);
      const { data: svc } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "service")
        .order("name");
      setServices(svc || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadProducts();

    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProducts]);

  

  const openDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      unit_price: product.unit_price.toString(),
      cost_price: (product.cost_price ?? 0).toString(),
      quantity_on_hand: product.quantity_on_hand.toString(),
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      unit_price: "",
      cost_price: "",
      quantity_on_hand: "",
    });
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

      if (!editingProduct) return;
      const { error } = await supabase
        .from("items")
        .update({ unit_price: parseFloat(formData.unit_price) })
        .eq("id", editingProduct.id);
      if (error) throw error;
      toast({ title: "Success", description: "Selling price updated" });

      setDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Product deleted" });
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }
    try {
      const name = createForm.name.trim();
      if (!name) {
        toast({ title: "Name required", description: "Enter a product name", variant: "destructive" });
        return;
      }
      const unit = parseFloat(createForm.unit_price || "0");
      if (!unit || unit <= 0) {
        toast({ title: "Invalid price", description: "Enter a valid selling price", variant: "destructive" });
        return;
      }
      const cost = createForm.cost_price ? parseFloat(createForm.cost_price) : 0;
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", u.id)
        .single();
      const company_id = (profile as any)?.company_id || companyId;
      if (!company_id) throw new Error("Company context missing");
      const { error } = await supabase
        .from("items")
        .insert({
          company_id,
          name,
          description: (createForm.description || "").trim(),
          item_type: "product",
          unit_price: unit,
          cost_price: cost,
          quantity_on_hand: 0
        } as any);
      if (error) throw error;
      toast({ title: "Product created", description: "Product added to catalog" });
      setCreateOpen(false);
      setCreateForm({ name: "", description: "", unit_price: "", cost_price: "" });
      loadProducts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", unit_price: "" });

  const [openingOpen, setOpeningOpen] = useState(false);
  const [openingForm, setOpeningForm] = useState({ productId: "", quantity: "", costPrice: "", date: new Date().toISOString().slice(0,10) });
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { toast({ title: "Permission denied", variant: "destructive" }); return; }
    try {
      const name = serviceForm.name.trim();
      if (!name) { toast({ title: "Name required", description: "Enter a service name", variant: "destructive" }); return; }
      const unit = parseFloat(serviceForm.unit_price || "0");
      if (!unit || unit <= 0) { toast({ title: "Invalid price", description: "Enter a valid service price", variant: "destructive" }); return; }
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", u.id)
        .single();
      const company_id = (profile as any)?.company_id || companyId;
      if (!company_id) throw new Error("Company context missing");
      const { error } = await supabase
        .from("items")
        .insert({ company_id, name, description: (serviceForm.description || "").trim(), item_type: "service", unit_price: unit, quantity_on_hand: 0 } as any);
      if (error) throw error;
      toast({ title: "Service created", description: "Service added to catalog" });
      setServiceOpen(false);
      setServiceForm({ name: "", description: "", unit_price: "" });
      loadProducts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const totalValue = products.reduce((sum, p) => sum + (p.unit_price * p.quantity_on_hand), 0);
  const totalCost = products.reduce((sum, p) => sum + (Number(p.cost_price ?? 0) * p.quantity_on_hand), 0);

  return (
    <div className="mt-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {totalCost.toLocaleString('en-ZA')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.reduce((sum, p) => sum + p.quantity_on_hand, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {totalValue.toLocaleString('en-ZA')}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Products & Services
          </CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" className="bg-gradient-primary" onClick={() => setCreateOpen(true)}>+ New Product</Button>
              <Button size="sm" variant="outline" onClick={() => setServiceOpen(true)}>+ New Service</Button>
              <Button size="sm" variant="secondary" onClick={() => setOpeningOpen(true)}>+ Opening Stock</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : products.length === 0 && services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products or services added yet</div>
          ) : (
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              {canEdit && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {product.description || "-"}
                </TableCell>
                <TableCell className="text-right">R {Number(product.cost_price ?? 0).toLocaleString('en-ZA')}</TableCell>
                <TableCell className="text-right">R {Number(product.unit_price).toLocaleString('en-ZA')}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={product.quantity_on_hand < 10 ? "destructive" : "secondary"}>
                    {product.quantity_on_hand}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  R {(product.unit_price * product.quantity_on_hand).toLocaleString('en-ZA')}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDialog(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteProduct(product.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {services.map((svc) => (
              <TableRow key={svc.id}>
                <TableCell className="font-medium">{svc.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{svc.description || "-"}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">R {Number(svc.unit_price).toLocaleString('en-ZA')}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-semibold">-</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => deleteProduct(svc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Product Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Selling Price (R) *</Label>
                <Input type="number" step="0.01" value={createForm.unit_price} onChange={(e) => setCreateForm({ ...createForm, unit_price: e.target.value })} required />
              </div>
              <div>
                <Label>Cost Price (R)</Label>
                <Input type="number" step="0.01" value={createForm.cost_price} onChange={(e) => setCreateForm({ ...createForm, cost_price: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openingOpen} onOpenChange={setOpeningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Opening Stock</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canEdit) { toast({ title: "Permission denied", variant: "destructive" }); return; }
              try {
                const pid = openingForm.productId;
                const qty = parseFloat(openingForm.quantity || "0");
                const cp = parseFloat(openingForm.costPrice || "0");
                const dateStr = openingForm.date || new Date().toISOString().slice(0,10);
                if (!pid) { toast({ title: "Select product", description: "Choose a product", variant: "destructive" }); return; }
                if (!(qty > 0) || !(cp > 0)) { toast({ title: "Invalid values", description: "Enter quantity and cost price > 0", variant: "destructive" }); return; }
                await transactionsApi.postOpeningStock({ productId: pid, quantity: qty, costPrice: cp, date: dateStr });
                toast({ title: "Opening stock posted", description: "Inventory and equity updated" });
                setOpeningOpen(false);
                setOpeningForm({ productId: "", quantity: "", costPrice: "", date: new Date().toISOString().slice(0,10) });
                loadProducts();
              } catch (err: any) {
                toast({ title: "Error", description: err.message || "Failed to post opening stock", variant: "destructive" });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label>Product *</Label>
              <Select value={openingForm.productId} onValueChange={(v: any) => setOpeningForm({ ...openingForm, productId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity *</Label>
                <Input type="number" step="1" min="1" value={openingForm.quantity} onChange={(e) => setOpeningForm({ ...openingForm, quantity: e.target.value })} required />
              </div>
              <div>
                <Label>Cost Price (R) *</Label>
                <Input type="number" step="0.01" value={openingForm.costPrice} onChange={(e) => setOpeningForm({ ...openingForm, costPrice: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Posting Date *</Label>
              <Input type="date" value={openingForm.date} onChange={(e) => setOpeningForm({ ...openingForm, date: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpeningOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary">Post</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Selling Price</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Product</Label>
              <Input value={formData.name} disabled />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} rows={2} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cost Price (R)</Label>
                <Input value={formData.cost_price} disabled />
              </div>
              <div>
                <Label>Selling Price (R) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Quantity in Stock</Label>
                <Input value={formData.quantity_on_hand} disabled />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingProduct(null); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary">Update Price</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-4">
            <div>
              <Label>Service Name *</Label>
              <Input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Price (R) *</Label>
              <Input type="number" step="0.01" value={serviceForm.unit_price} onChange={(e) => setServiceForm({ ...serviceForm, unit_price: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setServiceOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
