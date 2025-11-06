import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "", confirm: "" } });

  const onSubmit = async (values: FormValues) => {
    try {
      const invite = params.get('invite');
      if (invite) {
        try { localStorage.setItem('pendingInvite', invite); } catch {}
      }
      await signup(values.name, values.email, values.password);
      // After signup, try to attach company via invite
      if (invite) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: inv } = await supabase
              .from('invites')
              .select('company_id, role, token')
              .eq('token', invite)
              .maybeSingle();
            if (inv?.company_id) {
              await supabase.from('profiles').upsert({ user_id: user.id, company_id: inv.company_id }).throwOnError();
              await supabase.from('user_roles').upsert({ user_id: user.id, company_id: inv.company_id, role: inv.role }).throwOnError();
              await supabase.from('invites').delete().eq('token', invite);
            }
          }
        } catch {}
        try { localStorage.removeItem('pendingInvite'); } catch {}
      }
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "Signup failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="Sign Up | ApexAccounts" description="Create your ApexAccounts enterprise account" canonical={window.location.href} />
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/src/assets/sa-finance-hero.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/85 to-background/90" />
        
        <article className="w-full max-w-md rounded-lg border border-border bg-card/95 shadow-2xl p-8 relative z-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4">
              <span className="text-3xl font-bold text-primary-foreground">A</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ApexAccounts</h1>
            <p className="text-sm text-muted-foreground mt-2">Create your enterprise account</p>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Thabo Mokoena" {...field} />
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
                      <Input inputMode="email" autoComplete="email" placeholder="you@company.co.za" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-gradient-primary">Create account</Button>
            </form>
          </Form>

          <footer className="mt-4 text-center text-sm">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
