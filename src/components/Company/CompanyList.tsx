import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Globe, Phone, Mail, FileText, Check, Eye, Users, Trash2, UserPlus, Settings, Lock, AlertTriangle, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  vat_number: string | null;
  business_type: string | null;
  default_currency: string | null;
  logo_url: string | null;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  role: Role;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

type Role = 'administrator' | 'accountant' | 'manager';

const formSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  tax_number: z.string().optional(),
});

import { FinancialHealthInsight } from "@/components/Dashboard/FinancialHealthInsight";

export const CompanyList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  
  // Details Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Assign Accountant/User State
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState<Role>("accountant");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      tax_number: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchCompanies();
      checkCurrentCompany();
    }
  }, [user]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies. " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentCompany = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();
    
    if (data) {
      setCurrentCompanyId(data.company_id);
    }
  };

  const fetchTeamMembers = async (companyId: string) => {
    try {
      setTeamLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq("company_id", companyId);

      if (error) throw error;

      // Transform data to match interface
      const members = (data || []).map((item: any) => ({
        user_id: item.user_id,
        role: item.role,
        profile: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      }));

      setTeamMembers(members);
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleViewDetails = (company: Company) => {
    setSelectedCompany(company);
    fetchTeamMembers(company.id);
    setDetailsOpen(true);
  };

  const generateUuid = () => {
    try { return crypto.randomUUID(); } catch { /* fallback */ }
    const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return tpl.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!user) return;

      if (companies.length >= 3) {
        toast({
          title: "Limit Reached",
          description: "You can only have up to 3 companies in this prototype.",
          variant: "destructive",
        });
        return;
      }

      const newCompanyId = generateUuid();
      const cleanName = values.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const autoCode = `COMP-${cleanName}${randomSuffix}`;

      // 1. Insert Company
      const { error: companyError } = await supabase.from("companies").insert({
        id: newCompanyId,
        name: values.name,
        code: autoCode,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        tax_number: values.tax_number || null,
      });

      if (companyError) throw companyError;

      // 2. Link User to Company
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: user.id,
        company_id: newCompanyId,
        role: 'administrator'
      });

      if (roleError) {
        throw new Error("Failed to assign permissions: " + roleError.message);
      }

      setSuccessMessage(`Company "${values.name}" created with code ${autoCode}`);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsDialogOpen(false);
      }, 2000);
      
      form.reset();
      
      setTimeout(() => {
        fetchCompanies();
      }, 500);
      
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSwitchCompany = async (companyId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ company_id: companyId })
        .eq("user_id", user.id);

      if (error) throw error;

      setCurrentCompanyId(companyId);
      toast({
        title: "Switched Company",
        description: "You are now viewing data for " + companies.find(c => c.id === companyId)?.name,
      });
      
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to switch company: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleAssignUser = async () => {
    if (!assignEmail || !selectedCompany) return;
    setAssignError(null);
    
    try {
      setAssignLoading(true);
      
      // 1. Validate: Find user by email (Strict check against profiles)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .eq('email', assignEmail)
        .maybeSingle();

      if (!profileData) {
        setAssignError("User not found in the system. Please ensure the email is correct and the user has registered.");
        return;
      }

      // 2. Check if already assigned
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profileData.user_id)
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      if (existingRole) {
        setAssignError(`User is already a member of this company.`);
        return;
      }

      // 3. Assign Role
      const { error: assignError } = await supabase
        .from('user_roles')
        .insert({
          user_id: profileData.user_id,
          company_id: selectedCompany.id,
          role: assignRole
        });

      if (assignError) throw assignError;

      toast({
        title: "Success",
        description: `Assigned ${assignRole} role to ${profileData.first_name || assignEmail}`,
      });

      setIsAssignDialogOpen(false);
      setAssignEmail("");
      // Refresh team list
      fetchTeamMembers(selectedCompany.id);

    } catch (error: any) {
      console.error("Error assigning user:", error);
      setAssignError(error.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeletePassword("");
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete || !deletePassword) return;
    if (!user || !user.email) return;

    try {
      setDeleteLoading(true);

      // Verify password by attempting to sign in (re-auth)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (authError) {
        throw new Error("Incorrect password. Access denied.");
      }

      // Proceed with delete
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Company Deleted",
        description: `${companyToDelete.name} has been successfully removed.`,
      });

      setIsDeleteDialogOpen(false);
      fetchCompanies();

      // If active company was deleted, reload to force state update
      if (currentCompanyId === companyToDelete.id) {
        window.location.reload();
      }

    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
          <p className="text-muted-foreground">
            Manage your organizations. Limit: {companies.length}/3
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={companies.length >= 3} className="bg-gradient-primary">
              <Plus className="mr-2 h-4 w-4" /> Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
              <DialogDescription>
                Create a new company entity. Code will be auto-generated.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="contact@acme.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tax_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax / VAT Number</FormLabel>
                      <FormControl>
                        <Input placeholder="TAX-123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Create Company</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Company Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card 
            key={company.id} 
            className={`group relative transition-all duration-200 hover:shadow-md ${
              currentCompanyId === company.id 
                ? 'border-primary/50 shadow-sm' 
                : 'hover:border-primary/20'
            }`}
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClick(company); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CardHeader className="flex flex-row items-start space-y-0 pb-2 gap-4">
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {company.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {company.name}
                  {currentCompanyId === company.id && (
                    <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">Current</Badge>
                  )}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {company.code}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-sm text-muted-foreground space-y-2">
                {company.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{company.email}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{company.phone}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div>
                   <div className="text-[10px] uppercase text-muted-foreground font-medium">Currency</div>
                   <div className="text-sm font-medium">{company.default_currency || 'ZAR'}</div>
                </div>
                <div>
                   <div className="text-[10px] uppercase text-muted-foreground font-medium">Type</div>
                   <div className="text-sm font-medium capitalize">{company.business_type?.replace('_', ' ') || 'Company'}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0 pb-4 px-6">
               {currentCompanyId !== company.id ? (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1" 
                  onClick={() => handleSwitchCompany(company.id)}
                >
                  Switch
                </Button>
              ) : (
                <Button size="sm" className="flex-1" variant="secondary" disabled>
                  Active
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9 border"
                onClick={() => handleViewDetails(company)}
                title="View Details"
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </Button>
              <FinancialHealthInsight 
                companyId={company.id}
                trigger={
                  <Button variant="ghost" size="icon" className="h-9 w-9 border text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Financial Health">
                    <Activity className="h-4 w-4" />
                  </Button>
                }
              />
            </CardFooter>
          </Card>
        ))}
        {companies.length === 0 && !loading && (
           <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
             <Building2 className="h-12 w-12 mb-4 opacity-20" />
             <p className="text-lg font-medium">No companies found</p>
             <p className="text-sm">Create your first company to get started.</p>
           </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="bg-muted p-6 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedCompany?.name}</h2>
                <p className="text-muted-foreground font-mono text-sm mt-1">{selectedCompany?.code}</p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-white p-2 flex items-center justify-center border shadow-sm">
                {selectedCompany?.logo_url ? (
                  <img src={selectedCompany.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <div className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.email || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                <div className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.phone || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tax ID</Label>
                <div className="font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.tax_number || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Address</Label>
                <div className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.address || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">VAT Number</Label>
                <div className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.vat_number || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Business Type</Label>
                <div className="font-medium flex items-center gap-2 capitalize">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.business_type?.replace('_', ' ') || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Currency</Label>
                <div className="font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {selectedCompany?.default_currency || "N/A"}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Team Members</h3>
                </div>
                <Button size="sm" onClick={() => setIsAssignDialogOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Assign Accountant
                </Button>
              </div>
              
              {teamLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading team...</div>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {member.profile?.first_name?.[0] || member.profile?.email?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {[member.profile?.first_name, member.profile?.last_name].filter(Boolean).join(" ") || "Unknown User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.profile?.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize bg-white">
                          {member.role}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No members found assigned to this company.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="bg-muted/20 p-4 border-t">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Accountant Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Accountant</DialogTitle>
            <DialogDescription>
              Add an existing user to <strong>{selectedCompany?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {assignError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription>{assignError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                placeholder="accountant@example.com"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignUser} disabled={assignLoading}>
              {assignLoading ? "Assigning..." : "Assign User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Company
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{companyToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20 text-sm text-destructive flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Security Check: Please enter your administrator password to confirm deletion.</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteCompany} 
              disabled={!deletePassword || deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
          <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
            <p className="text-muted-foreground">The operation has been completed successfully.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
