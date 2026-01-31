import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Customer {
  id: string;
  name: string;
  customer_code: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  shipping_address: string | null;
  credit_limit: number;
  payment_terms: string | null;
  tax_number: string | null;
  customer_type: string | null;
  notes: string | null;
  is_active: boolean;
  salesperson_id: string | null;
  company_id: string;
  created_at: string;
}

interface CustomerFormProps {
  customer?: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    customer_code: customer?.customer_code || "",
    contact_person: customer?.contact_person || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    mobile: customer?.mobile || "",
    address: customer?.address || "",
    shipping_address: customer?.shipping_address || "",
    credit_limit: customer?.credit_limit?.toString() || "0",
    payment_terms: customer?.payment_terms || "30 days",
    tax_number: customer?.tax_number || "",
    customer_type: customer?.customer_type || "Retail",
    notes: customer?.notes || "",
    is_active: customer?.is_active ?? true,
    salesperson_id: customer?.salesperson_id || "",
    same_as_billing: false
  });

  useEffect(() => {
    // Load salespeople (users)
    const loadUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name');
      if (data) setSalespeople(data);
    };
    loadUsers();

    // Auto-generate code if new
    if (!customer) {
      const generateCode = async () => {
        const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        const nextNum = (count || 0) + 1;
        setFormData(prev => ({ ...prev, customer_code: `CUST-${String(nextNum).padStart(4, '0')}` }));
      };
      generateCode();
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const payload = {
        company_id: profile.company_id,
        name: formData.name,
        customer_code: formData.customer_code,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        address: formData.address || null,
        shipping_address: formData.same_as_billing ? formData.address : (formData.shipping_address || null),
        credit_limit: parseFloat(formData.credit_limit) || 0,
        payment_terms: formData.payment_terms || null,
        tax_number: formData.tax_number || null,
        customer_type: formData.customer_type || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
        salesperson_id: formData.salesperson_id || null,
      };

      let error;
      if (customer) {
        const { error: updateError } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", customer.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("customers")
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Success", description: `Customer ${customer ? 'updated' : 'created'} successfully` });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Customer Name *</Label>
          <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Customer Code *</Label>
          <Input required value={formData.customer_code} onChange={e => setFormData({...formData, customer_code: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Tax / VAT Number</Label>
          <Input value={formData.tax_number} onChange={e => setFormData({...formData, tax_number: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Contact Person</Label>
          <Input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Mobile</Label>
          <Input value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Customer Type</Label>
          <Select value={formData.customer_type} onValueChange={v => setFormData({...formData, customer_type: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Retail">Retail</SelectItem>
              <SelectItem value="Wholesale">Wholesale</SelectItem>
              <SelectItem value="Corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Credit Limit</Label>
          <Input type="number" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Payment Terms</Label>
          <Select value={formData.payment_terms} onValueChange={v => setFormData({...formData, payment_terms: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COD">Cash on Delivery</SelectItem>
              <SelectItem value="7 Days">7 Days</SelectItem>
              <SelectItem value="14 Days">14 Days</SelectItem>
              <SelectItem value="30 Days">30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Salesperson</Label>
          <Select value={formData.salesperson_id} onValueChange={v => setFormData({...formData, salesperson_id: v})}>
            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              {salespeople.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Billing Address *</Label>
        <Textarea required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
      </div>

      <div className="flex items-center space-x-2">
        <Switch checked={formData.same_as_billing} onCheckedChange={c => setFormData({...formData, same_as_billing: c})} />
        <Label>Shipping Address same as Billing</Label>
      </div>

      {!formData.same_as_billing && (
        <div className="space-y-2">
          <Label>Shipping Address</Label>
          <Textarea value={formData.shipping_address} onChange={e => setFormData({...formData, shipping_address: e.target.value})} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
      </div>

      <div className="flex items-center space-x-2">
        <Switch checked={formData.is_active} onCheckedChange={c => setFormData({...formData, is_active: c})} />
        <Label>Active Customer</Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}
