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
import { Github, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { enableDemoMode } from "@/lib/demo-data";
import signupBg from "@/assets/stella-sign-up.jpg";

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

  useEffect(() => { 
    if (signupMsg) { 
      try { localStorage.removeItem('just_signed_up'); } catch {} 
    } 
  }, [signupMsg]);

  useEffect(() => {
    if (user && !signupMsg) navigate("/", { replace: true });
  }, [user, navigate, signupMsg]);

  const form = useForm<FormValues>({ 
    resolver: zodResolver(schema), 
    defaultValues: { email: "", password: "", remember: true } 
  });

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

  const startCloudDemo = async () => {
    const email = "demo@stella-lumen.com";
    const password = "Demo123!";
    try {
      if (!hasSupabaseEnv) {
        enableDemoMode();
        navigate("/", { replace: true });
        return;
      }
      let signedIn = false;
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (!res.error) {
        signedIn = true;
      } else {
        const su = await supabase.auth.signUp({ email, password });
        if (!su.error) {
          await new Promise(r => setTimeout(r, 300));
          const si = await supabase.auth.signInWithPassword({ email, password });
          if (!si.error) signedIn = true;
        }
      }
      enableDemoMode();
      navigate("/", { replace: true });
    } catch {
      try { enableDemoMode(); } catch {}
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <SEO title="Login | Rigel Business" description="Secure login to Rigel Business enterprise dashboard" canonical={window.location.href} />
      <div className="container relative min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        
        {/* Right Side - Visual (Hidden on mobile) */}
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-slate-900">
             <img 
               src={signupBg} 
               alt="Office background" 
               className="h-full w-full object-cover opacity-50 mix-blend-overlay"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          </div>
          <div className="relative z-20 flex items-center gap-4 text-3xl font-bold">
            <img src="/logo.png" alt="Rigel" className="h-48 w-auto rounded-xl shadow-lg" />
            Rigel Business
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Rigel Business has transformed how we manage our finances. The automated VAT calculations and seamless invoicing save us hours every week.&rdquo;
              </p>
              <footer className="text-sm text-slate-300">South African Enterprise Client</footer>
            </blockquote>
          </div>
        </div>

        {/* Left Side - Login Form */}
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px] border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-8 shadow-xl rounded-2xl">
            <div className="flex flex-col space-y-2 text-center">
              {/* Mobile Logo (visible on small screens, hidden on lg if needed, but keeping it here is fine for brand reinforcement) */}
              <div className="flex justify-center mb-4 lg:hidden">
                 <img src="/logo.png" alt="Rigel" className="h-16 w-auto" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access your dashboard
              </p>
            </div>

            {signupMsg && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-sm font-medium">Account created successfully</p>
                </div>
                <p className="mt-1 text-xs ml-6 opacity-90">Please sign in to continue.</p>
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
                        <Input 
                          placeholder="name@example.com" 
                          type="email" 
                          autoCapitalize="none" 
                          autoComplete="email" 
                          autoCorrect="off" 
                          className="bg-background"
                          {...field} 
                        />
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
                        <Link 
                          to="/forgot-password" 
                          className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input 
                          placeholder="••••••••" 
                          type="password" 
                          autoComplete="current-password" 
                          className="bg-background"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remember"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <input 
                          type="checkbox" 
                          checked={field.value} 
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Remember me</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 transition-opacity">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" onClick={() => oauthSignIn("google")}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" onClick={() => oauthSignIn("github")}>
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
            </div>

            <Button 
              variant="secondary" 
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={startCloudDemo}
            >
              Try Cloud Demo
            </Button>

            <p className="px-8 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link 
                to="/signup" 
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}