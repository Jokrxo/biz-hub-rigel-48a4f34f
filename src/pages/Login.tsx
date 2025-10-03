import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include letters and numbers"),
  remember: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      const redirect = params.get("redirect") || "/";
      navigate(redirect, { replace: true });
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="Login | ApexAccounts" description="Secure login to ApexAccounts enterprise dashboard" canonical={window.location.href} />
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Fixed Background Image */}
        <div className="absolute inset-0 bg-[url('/src/assets/sa-finance-hero.jpg')] bg-cover bg-center bg-fixed" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/60 to-background/80 backdrop-blur-sm" />
        
        <article className="w-full max-w-md rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-elegant p-8 relative z-10 animate-float">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 animate-glow">
              <span className="text-3xl font-bold text-primary-foreground">A</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ApexAccounts</h1>
            <p className="text-sm text-muted-foreground mt-2">Enterprise Accounting & Financial Management</p>
          </header>

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

          <footer className="mt-4 text-center text-sm">
            Don&apos;t have an account? <Link to="/signup" className="text-primary hover:underline">Create one</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
