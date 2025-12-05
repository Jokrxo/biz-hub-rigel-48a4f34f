import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/useAuth";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)");

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name"),
    email: z.string().trim().email("Enter a valid email"),
    password: passwordSchema,
    confirm: z.string(),
    companyName: z.string().trim().min(2, "Enter company name"),
    companyAddress: z.string().trim().min(5, "Enter company address"),
    companyPhone: z.string().trim().min(10, "Phone number must be 10 digits").max(20, "Phone number too long").refine((v) => v.replace(/\D/g, '').length === 10, "Phone number must be 10 digits"),
    termsAccepted: z.boolean().refine((v) => v === true, "You must accept the Terms & Conditions"),
  })
  .refine((data) => data.password === data.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "", confirm: "", companyName: "", companyAddress: "", companyPhone: "", termsAccepted: false } });

  // Helper function to format error messages
  const formatErrorMessage = (error: any): string => {
    const message = error?.message || String(error);
    
    // Check for common Supabase password validation errors
    if (message.toLowerCase().includes("password") && message.toLowerCase().includes("contain")) {
      return "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character";
    }
    
    if (message.toLowerCase().includes("password") && message.toLowerCase().includes("length")) {
      return "Password must be at least 8 characters long";
    }
    
    // Return original message if no match
    return message;
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const invite = params.get('invite');
      if (invite) {
        try { localStorage.setItem('pendingInvite', invite); } catch {}
      }
      await signup(values.name, values.email, values.password);
      try { localStorage.setItem('just_signed_up', 'true'); } catch {}
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .maybeSingle();
          const companyId = profile?.company_id || null;
          if (companyId) {
            await supabase.from('companies').update({ name: values.companyName, address: values.companyAddress, phone: values.companyPhone }).eq('id', companyId);
            try { await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() as any }).eq('user_id', user.id); } catch {}
          } else {
            const { data: createdCompany } = await supabase
              .from('companies')
              .insert({ name: values.companyName, address: values.companyAddress, phone: values.companyPhone, default_currency: 'ZAR' })
              .select('id')
              .single();
            if (createdCompany?.id) {
              await supabase.from('profiles').update({ company_id: createdCompany.id, terms_accepted_at: new Date().toISOString() as any }).eq('user_id', user.id);
              await supabase.from('user_roles').upsert({ user_id: user.id, company_id: createdCompany.id, role: 'administrator' });
            }
          }
        }
      } catch {}
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
      try { await supabase.auth.signOut({ scope: 'local' as any }); } catch {}
      toast({ title: "Account created", description: "Please sign in to your new account", });
      navigate("/login?signup=success", { replace: true });
    } catch (e: any) {
      const errorMessage = formatErrorMessage(e);
      toast({ title: "Signup failed", description: errorMessage, variant: "destructive" });
    }
  };

  // Password requirement checks
  const passwordChecks = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  return (
    <>
      <SEO title="Sign Up | Rigel Business" description="Create your Rigel Business enterprise account" canonical={window.location.href} />
      <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/src/assets/background-picture.jpg')] bg-cover bg-center" />
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
                      <Input 
                        type="password" 
                        autoComplete="new-password" 
                        placeholder="••••••••" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setPassword(e.target.value);
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 text-xs mt-2">
                      <div className={`flex items-center gap-2 ${passwordChecks.minLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <span>{passwordChecks.minLength ? '✓' : '○'}</span>
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordChecks.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <span>{passwordChecks.hasLowercase ? '✓' : '○'}</span>
                        <span>One lowercase letter (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordChecks.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <span>{passwordChecks.hasUppercase ? '✓' : '○'}</span>
                        <span>One uppercase letter (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordChecks.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <span>{passwordChecks.hasNumber ? '✓' : '○'}</span>
                        <span>One number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordChecks.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <span>{passwordChecks.hasSpecial ? '✓' : '○'}</span>
                        <span>One special character</span>
                      </div>
                    </div>
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

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Rigel Business (Pty) Ltd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main Road, Sandton, 2196" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company phone</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" placeholder="0812345678" {...field} />
                  </FormControl>
                  <FormDescription>10 digits, numbers only</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="terms" />
                    <FormLabel htmlFor="terms">I accept the Terms & Conditions</FormLabel>
                    <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setTermsOpen(true)}>View Terms</Button>
                  </div>
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

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Terms & Conditions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm max-h-[50vh] overflow-y-auto">
            <p>By creating an account, you agree to the Rigel Business Terms & Conditions, including acceptable use, data handling, and payment terms for paid plans.</p>
            <p>Key points:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the service responsibly and lawfully.</li>
              <li>Protect your credentials; you are responsible for all activity under your account.</li>
              <li>We process and store your data in accordance with our Privacy Policy.</li>
              <li>Paid features require a valid license; fees are non-refundable unless required by law.</li>
            </ul>
            <p>For full terms, contact support or view the legal documentation provided with your plan.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
