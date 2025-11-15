import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  quantity_on_hand: number;
  item_type: string;
}

export const SalesProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_price: "",
    quantity_on_hand: "",
  });

  useEffect(() => {
    loadProducts();

    // Real-time updates
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProducts = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "product")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || "",
        unit_price: product.unit_price.toString(),
        quantity_on_hand: product.quantity_on_hand.toString(),
      });
    } else {
      setEditingProduct(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      unit_price: "",
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

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from("items")
          .update({
            name: formData.name,
            description: formData.description || null,
            unit_price: parseFloat(formData.unit_price),
            quantity_on_hand: parseFloat(formData.quantity_on_hand),
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast({ title: "Success", description: "Product updated successfully" });
      } else {
        // Create new product
        const { error } = await supabase.from("items").insert({
          company_id: profile!.company_id,
          name: formData.name,
          description: formData.description || null,
          unit_price: parseFloat(formData.unit_price),
          quantity_on_hand: parseFloat(formData.quantity_on_hand),
          item_type: "product",
        });

        if (error) throw error;
        toast({ title: "Success", description: "Product added successfully" });
      }

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

  const canEdit = isAdmin || isAccountant;

  const totalValue = products.reduce((sum, p) => sum + (p.unit_price * p.quantity_on_hand), 0);

  return (
    <div className="mt-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <Button className="bg-gradient-primary" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products added yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Description</TableHead>
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter product name"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description (optional)"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Quantity in Stock *</Label>
                <Input
                  type="number"
                  step="1"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingProduct(null); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary">
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};