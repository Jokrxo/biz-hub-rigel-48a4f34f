import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name"),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include letters and numbers"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "", confirm: "" } });

  const onSubmit = async (values: FormValues) => {
    try {
      await signup(values.name, values.email, values.password);
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "Signup failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="Sign Up | ApexAccounts" description="Create your ApexAccounts enterprise account" canonical={window.location.href} />
      <main className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-background flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 backdrop-blur-3xl" />
        <article className="w-full max-w-md rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-elegant p-8 relative z-10 animate-float">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 animate-glow">
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
