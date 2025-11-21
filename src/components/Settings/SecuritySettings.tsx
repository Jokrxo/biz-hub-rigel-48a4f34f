import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, LogOut } from "lucide-react";

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={savingPwd} className="bg-gradient-primary w-full">Change Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Email</CardTitle>
          <CardDescription>Update your sign-in email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={changeEmail} disabled={savingEmail} variant="outline" className="w-full">Update Email</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogOut className="h-5 w-5 text-primary" />Sessions</CardTitle>
          <CardDescription>Sign out from all devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={signOutAll} disabled={signingOutAll} variant="destructive" className="w-full">Sign Out Everywhere</Button>
        </CardContent>
      </Card>
    </div>
  );
};