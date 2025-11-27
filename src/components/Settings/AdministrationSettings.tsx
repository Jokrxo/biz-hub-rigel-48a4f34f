import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, UserPlus, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

export const AdministrationSettings = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "accountant" as const,
  });
  // Invites
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("accountant");
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const canManageUsers = isAdmin || isAccountant;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", currentUser?.id)
        .single();
      if (!profile) return;
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("company_id", profile.company_id);
      if (profilesError) throw profilesError;
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", profile.company_id);
      if (rolesError) throw rolesError;
      const usersWithRoles = profiles?.map(p => ({
        id: p.user_id,
        email: p.email || "",
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        roles: userRoles?.filter(r => r.user_id === p.user_id).map(r => r.role) || [],
      })) || [];
      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, toast]);
  const loadInvites = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", currentUser?.id)
        .single();
      if (!profile) return;
      const { data } = await supabase
        .from('invites')
        .select('email, role, token, expires_at')
        .eq('company_id', profile.company_id)
        .order('expires_at', { ascending: true });
      setPendingInvites(data || []);
    } catch {}
  }, [currentUser?.id]);
  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
      loadInvites();
    }
  }, [canManageUsers, loadUsers, loadInvites]);


  const handleCreateUser = async () => {
    try {
      // Validate inputs
      if (!newUser.email || !newUser.password || !newUser.firstName || !newUser.lastName) {
        toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
        return;
      }

      // Special password check for Admin123 - allows bypass of normal validation
      const isSpecialPassword = newUser.password === "Admin123";
      
      // Normal password validation (only if not special password)
      if (!isSpecialPassword && newUser.password.length < 6) {
        toast({ title: "Invalid password", description: "Password must be at least 6 characters long", variant: "destructive" });
        return;
      }

      // Get current company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", currentUser?.id)
        .single();

      if (!profile) throw new Error("Company not found");

      // Create auth user (admin API call needed - this is a simplified version)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            first_name: newUser.firstName,
            last_name: newUser.lastName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Update profile with company
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          company_id: profile.company_id,
          first_name: newUser.firstName,
          last_name: newUser.lastName 
        })
        .eq("user_id", authData.user.id);

      if (profileError) throw profileError;

      // Assign role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          company_id: profile.company_id,
          role: newUser.role,
        });

      if (roleError) throw roleError;

      toast({ title: "Success", description: "User created successfully" });
      setIsCreateDialogOpen(false);
      setNewUser({ email: "", password: "", firstName: "", lastName: "", role: "accountant" });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateInvite = async () => {
    try {
      if (!inviteEmail) throw new Error('Email is required');
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', currentUser?.id)
        .single();
      if (!profile) throw new Error('Company not found');
      const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { error } = await supabase
        .from('invites')
        .insert({ company_id: profile.company_id, email: inviteEmail, role: inviteRole, token, expires_at: expires.toISOString() });
      if (error) throw error;
      const link = `${window.location.origin}/signup?invite=${token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast({ title: 'Invite created', description: 'Link copied to clipboard' });
      setInviteEmail("");
      setInviteRole('accountant');
      loadInvites();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", currentUser?.id)
        .single();

      if (!profile) return;

      // Delete existing roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", profile.company_id);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          company_id: profile.company_id,
          role: newRole,
        });

      if (error) throw error;

      toast({ title: "Success", description: "User role updated successfully" });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", currentUser?.id)
        .single();

      if (!profile) return;

      // Check if user being deleted is an admin and current user is not admin
      const { data: targetUserRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("company_id", profile.company_id)
        .single();

      if (targetUserRole?.role === "administrator" && !isAdmin) {
        toast({ 
          title: "Error", 
          description: "Only administrators can delete other administrators", 
          variant: "destructive" 
        });
        return;
      }

      // Remove roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", profile.company_id);

      // Remove profile
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Success", description: "User deleted successfully" });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            You don't have permission to access administration settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              User Administration
            </CardTitle>
            <CardDescription>Manage users, roles, and permissions</CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Minimum 6 characters or use 'Admin123'"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use 'Admin123' for instant access (accountants only)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(val: any) => setNewUser({ ...newUser, role: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="administrator">Administrator</SelectItem>}
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} className="w-full bg-gradient-primary">
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Invite Section */}
        <div className="mb-6 p-4 border rounded">
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Invite by Email</Label>
              <Input placeholder="user@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole as any}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="administrator">Administrator</SelectItem>}
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button className="w-full" onClick={handleCreateInvite}>Create Invite</Button>
            </div>
          </div>
          {pendingInvites.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm">Pending Invites</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((inv) => (
                    <TableRow key={inv.token}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>{inv.role}</TableCell>
                      <TableCell>{new Date(inv.expires_at).toLocaleDateString('en-ZA')}</TableCell>
                      <TableCell className="text-xs">
                        {`${window.location.origin}/signup?invite=${inv.token}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.first_name} {user.last_name}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.roles[0] || "accountant"}
                    onValueChange={(val) => handleUpdateRole(user.id, val)}
                    disabled={user.id === currentUser?.id}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && (
                        <SelectItem value="administrator">
                          <Badge variant="destructive">Administrator</Badge>
                        </SelectItem>
                      )}
                      <SelectItem value="accountant">
                        <Badge>Accountant</Badge>
                      </SelectItem>
                      <SelectItem value="manager">
                        <Badge variant="secondary">Manager</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={user.id === currentUser?.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
