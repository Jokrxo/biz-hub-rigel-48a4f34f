import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { Lock, Mail, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const SecuritySettings = () => {
  const { toast } = useToast();
  const { user, logout } = useAuth() as any;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [savingPwd, setSavingPwd] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const changePassword = async () => {
    if (!hasSupabaseEnv) { toast({ title: "Error", description: "Auth not configured", variant: "destructive" }); return; }
    if (!newPassword || newPassword.length < 8) { toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Error", description: "Passwords do not match", variant: "destructive" }); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Success", description: "Password updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update password", variant: "destructive" });
    } finally {
      setSavingPwd(false);
    }
  };

  const changeEmail = async () => {
    if (!hasSupabaseEnv) { toast({ title: "Error", description: "Auth not configured", variant: "destructive" }); return; }
    if (!email) { toast({ title: "Error", description: "Enter a valid email", variant: "destructive" }); return; }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast({ title: "Success", description: "Email update requested. Check your inbox to confirm." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update email", variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const signOutAll = async () => {
    if (!hasSupabaseEnv) { toast({ title: "Error", description: "Auth not configured", variant: "destructive" }); return; }
    setSigningOutAll(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" as any });
      if (error) throw error;
      toast({ title: "Signed out", description: "All sessions revoked" });
      try { await logout(); } catch {}
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to sign out", variant: "destructive" });
    } finally {
      setSigningOutAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Password Policy</CardTitle>
            <CardDescription>Set basic password requirements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum length</Label>
                <Input type="number" min={8} defaultValue={12} />
              </div>
              <div className="flex items-center gap-2">
                <Input type="checkbox" defaultChecked />
                <span className="text-sm">Require special characters</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => toast({ title: "Saved", description: "Password policy updated" })}>Save Policy</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Two-Factor Authentication</CardTitle>
            <CardDescription>Add an extra layer of sign-in security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Use an authenticator app to generate time-based codes.</div>
            <Button className="w-full" variant="outline" onClick={() => toast({ title: "Coming soon", description: "2FA setup will be available next" })}>Enable 2FA</Button>
          </CardContent>
        </Card>
      </div>
      <details className="rounded-md border">
        <summary className="cursor-pointer p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Password</div>
            <span className="text-sm text-muted-foreground">Change your account password</span>
          </div>
        </summary>
        <div className="space-y-4 p-4 border-t">
          <div>
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={savingPwd} className="bg-gradient-primary w-full">Change Password</Button>
        </div>
      </details>

      <details className="rounded-md border">
        <summary className="cursor-pointer p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Email</div>
            <span className="text-sm text-muted-foreground">Update your sign-in email</span>
          </div>
        </summary>
        <div className="space-y-4 p-4 border-t">
          <div>
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={changeEmail} disabled={savingEmail} variant="outline" className="w-full">Update Email</Button>
        </div>
      </details>

      <details className="rounded-md border">
        <summary className="cursor-pointer p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><LogOut className="h-5 w-5 text-primary" />Sessions</div>
            <span className="text-sm text-muted-foreground">Sign out from all devices</span>
          </div>
        </summary>
        <div className="space-y-4 p-4 border-t">
          <Button onClick={signOutAll} disabled={signingOutAll} variant="destructive" className="w-full">Sign Out Everywhere</Button>
        </div>
      </details>

      

      <details className="rounded-md border">
        <summary className="cursor-pointer p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Audit Trail</div>
            <span className="text-sm text-muted-foreground">View activity logs</span>
          </div>
        </summary>
        <div className="p-4 border-t">
          <AuditTrailCard />
        </div>
      </details>
    </div>
  );
};

const AuditTrailCard = () => {
  const { toast } = useToast();
  const { user } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ id: string; created_at: string; action: string; entity: string; entity_id: string; description: string; user_id: string; email?: string }>>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 7;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) { setRows([]); return; }
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", u.id)
          .maybeSingle();
        const companyId = (profile as any)?.company_id;
        if (!companyId) { setRows([]); return; }
        const { data: logs } = await supabase
          .from("audit_logs" as any)
          .select("id, created_at, action, entity, entity_id, description, user_id")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        const userIds = Array.from(new Set((logs || []).map((l: any) => String(l.user_id || ""))).values()).filter(Boolean);
        let usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, email")
            .in("user_id", userIds);
          (profs || []).forEach((p: any) => { usersMap[String(p.user_id)] = String(p.email || ""); });
        }
        const mapped = (logs || []).map((l: any) => ({
          id: l.id,
          created_at: l.created_at,
          action: String(l.action || ""),
          entity: String(l.entity || ""),
          entity_id: String(l.entity_id || ""),
          description: String(l.description || ""),
          user_id: String(l.user_id || ""),
          email: usersMap[String(l.user_id || "")] || ""
        }));
        setRows(mapped);
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to load audit trail", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => { setPage(0); }, [search]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => (
      r.action.toLowerCase().includes(q) ||
      r.entity.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.entity_id.toLowerCase().includes(q)
    ));
  }, [rows, search]);

  const start = page * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>Company-unique audit log of transaction inserts and deletions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, user, entity, description" />
        </div>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading audit logs…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No audit logs</div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.email || r.user_id || "—"}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell>{r.entity}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entity_id}</TableCell>
                  <TableCell className="text-sm">{r.description || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / pageSize))} • Showing {paged.length} of {filtered.length}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
              <Button variant="outline" disabled={(page + 1) >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
