import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch(`/api/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error((await res.json()).message || "Request failed");
      toast({ title: "Email sent", description: "Check your inbox for password reset instructions." });
    } catch (e: any) {
      toast({ title: "Request failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="Forgot Password | ApexAccounts" description="Reset your ApexAccounts password" canonical={window.location.href} />
      <main className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-background flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 backdrop-blur-3xl" />
        <article className="w-full max-w-md rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-elegant p-8 relative z-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 animate-glow">
              <span className="text-3xl font-bold text-primary-foreground">A</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">ApexAccounts</h1>
            <p className="text-sm text-muted-foreground mt-2">Reset your password</p>
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

              <Button type="submit" className="w-full bg-gradient-primary">Send reset link</Button>
            </form>
          </Form>
        </article>
      </main>
    </>
  );
}
