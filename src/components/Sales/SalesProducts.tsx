import { useState, useEffect, useCallback, useMemo } from "react";
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
import { 
  Plus, 
  Package, 
  Trash2, 
  Edit, 
  Search, 
  MoreHorizontal, 
  FileText,
  Briefcase,
  Box
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  // Forms
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

  const [serviceForm, setServiceForm] = useState({ name: "", description: "", unit_price: "" });
  const [openingForm, setOpeningForm] = useState({ productId: "", quantity: "", costPrice: "", date: new Date().toISOString().slice(0,10) });

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

  const filteredItems = useMemo(() => {
    const allItems = [...products, ...services];
    if (!searchTerm) return allItems.sort((a, b) => a.name.localeCompare(b.name));
    
    return allItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, services, searchTerm]);

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
    if (!confirm("Delete this item?")) return;
    try {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Item deleted" });
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
      
      const { error } = await supabase
        .from("items")
        .insert({
          company_id: companyId,
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

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { toast({ title: "Permission denied", variant: "destructive" }); return; }
    try {
      const name = serviceForm.name.trim();
      if (!name) { toast({ title: "Name required", description: "Enter a service name", variant: "destructive" }); return; }
      const unit = parseFloat(serviceForm.unit_price || "0");
      if (!unit || unit <= 0) { toast({ title: "Invalid price", description: "Enter a valid service price", variant: "destructive" }); return; }
      
      const { error } = await supabase
        .from("items")
        .insert({ 
          company_id: companyId, 
          name, 
          description: (serviceForm.description || "").trim(), 
          item_type: "service", 
          unit_price: unit, 
          quantity_on_hand: 0 
        } as any);
      if (error) throw error;
      toast({ title: "Service created", description: "Service added to catalog" });
      setServiceOpen(false);
      setServiceForm({ name: "", description: "", unit_price: "" });
      loadProducts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products & services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        {canEdit && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" className="bg-gradient-primary" onClick={() => setCreateOpen(true)}>
              <Box className="h-4 w-4 mr-2" /> New Product
            </Button>
            <Button size="sm" variant="outline" onClick={() => setServiceOpen(true)}>
              <Briefcase className="h-4 w-4 mr-2" /> New Service
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpeningOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Opening Stock
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border bg-card">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No products or services found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.item_type === 'service' ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Service</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Product</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.item_type === 'product' ? `R ${Number(item.cost_price ?? 0).toLocaleString('en-ZA')}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">R {Number(item.unit_price).toLocaleString('en-ZA')}</TableCell>
                  <TableCell className="text-right">
                    {item.item_type === 'product' ? (
                      <Badge variant={item.quantity_on_hand < 10 ? "destructive" : "secondary"}>
                        {item.quantity_on_hand}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.item_type === 'product' 
                      ? `R ${(item.unit_price * item.quantity_on_hand).toLocaleString('en-ZA')}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openDialog(item)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Price
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteProduct(item.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

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
