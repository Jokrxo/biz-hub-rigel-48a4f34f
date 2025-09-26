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
      <SEO title="Forgot Password | SA Finance Manager" description="Reset your SA Finance Manager password" canonical={window.location.href} />
      <main className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <article className="w-full max-w-md rounded-lg border border-border bg-card shadow-sm p-6">
          <header className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="text-sm text-muted-foreground mt-1">We will email you a secure reset link</p>
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
