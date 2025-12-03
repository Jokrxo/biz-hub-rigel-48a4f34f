import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/useAuth";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import { Calculator, Github, Users } from "lucide-react";
import stellaLogo from "@/assets/stellkhygugvyt.jpg";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const signupMsg = params.get('signup') === 'success' || (typeof localStorage !== 'undefined' && localStorage.getItem('just_signed_up') === 'true');
  useEffect(() => { if (signupMsg) { try { localStorage.removeItem('just_signed_up'); } catch {} } }, [signupMsg]);

  useEffect(() => {
    if (user && !signupMsg) navigate("/", { replace: true });
  }, [user, navigate, signupMsg]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });
  

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      try { localStorage.setItem('just_logged_in', 'true'); } catch {}
      const redirect = params.get("redirect") || "/";
      navigate(redirect, { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    }
  };

  const oauthSignIn = async (provider: "google" | "github" | "azure") => {
    try {
      if (!hasSupabaseEnv) {
        toast({ title: "Auth unavailable", description: "Supabase is not configured", variant: "destructive" });
        return;
      }
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) throw error;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Sign-in failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="Login | Rigel Business" description="Secure login to Rigel Business enterprise dashboard" canonical={window.location.href} />
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/src/assets/stella-sign-up.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/85 to-background/90" />
        
        <article className="w-full max-w-md rounded-lg border border-border bg-card/95 shadow-2xl p-8 relative z-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 overflow-hidden border border-border bg-background">
              <img
                src="/Modern Rigel Business Logo Design.png"
                alt="Rigel Business"
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget.style.display = 'none'); }}
              />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Rigel Business</h1>
            <p className="text-sm text-muted-foreground mt-2">Enterprise Accounting & Financial Management</p>
            
          </header>

          {signupMsg && (
            <div className="mb-4 rounded-md border bg-muted/40 p-3">
              <div className="text-sm font-medium">Account created successfully</div>
              <div className="text-xs text-muted-foreground">Please sign in to access your dashboard. We’ve sent a verification email if required.</div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remember"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <input id="remember" type="checkbox" className="h-4 w-4" checked={field.value} onChange={field.onChange} />
                    <Label htmlFor="remember">Remember me</Label>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-gradient-primary">Sign in</Button>
            </form>
          </Form>

          <div className="mt-6 space-y-3">
            <div className="flex items-center">
              <div className="h-px flex-1 bg-border" />
              <span className="mx-3 text-xs text-muted-foreground">Or continue with</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" onClick={() => oauthSignIn("google")}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5h-1.9v-.1H24v7.2h11.3c-1.6 4.9-6.2 8.4-11.3 8.4-6.8 0-12.4-5.5-12.4-12.4s5.5-12.4 12.4-12.4c3.1 0 5.9 1.1 8.1 3l5-5C33.9 5.1 29.2 3 24 3 12 3 2.4 12.6 2.4 24.6S12 46.1 24 46.1c11.4 0 21.1-8.2 21.1-21.5 0-1.6-.2-3.2-.5-4.7z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l5.9 4.3C14 15 18.7 12.2 24 12.2c3.1 0 5.9 1.1 8.1 3l5-5C33.9 5.1 29.2 3 24 3 16 3 9.2 7.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 46.1c5.7 0 10.4-1.8 14-4.9l-5.1-4.2c-2.1 1.4-4.9 2.3-8.9 2.3-5 0-9.7-3.2-11.3-8.1l-6 4.6c2.9 7.2 9.7 10.3 17.3 10.3z"/>
                  <path fill="#1976D2" d="M43.6 20.5H24v7.2h11.3c-1.6 4.9-6.2 8.4-11.3 8.4-5 0-9.7-3.2-11.3-8.1l-6 4.6c2.9 7.2 9.7 10.3 17.3 10.3 11.4 0 21.1-8.2 21.1-21.5 0-1.6-.2-3.2-.5-4.7z"/>
                </svg>
                Google
              </Button>
              <Button type="button" variant="outline" onClick={() => oauthSignIn("github")}>
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
              <Button type="button" variant="outline" onClick={() => oauthSignIn("azure")}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#F35325" />
                  <rect x="13" y="1" width="10" height="10" fill="#81BC06" />
                  <rect x="1" y="13" width="10" height="10" fill="#05A6F0" />
                  <rect x="13" y="13" width="10" height="10" fill="#FFBA08" />
                </svg>
                Microsoft
              </Button>
            </div>
          </div>

          <footer className="mt-6 text-center text-sm">
            Don&apos;t have an account? <Link to="/signup" className="text-primary hover:underline">Create one</Link>
          </footer>

          <footer className="mt-8 text-center">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="inline-block h-px w-10 bg-gradient-to-r from-transparent via-border to-transparent" />
              <img src={stellaLogo} alt="Stella Lumen" className="h-5 w-5 rounded object-cover border" />
              <span>Powered by Stella Lumen</span>
              <span className="inline-block h-px w-10 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
          </footer>

          

          <footer className="mt-4 text-center">
            <a
              href="/community"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Users className="h-4 w-4" />
              Rigel Community
            </a>
          </footer>
        </article>
      </main>
    </>
  );
}
