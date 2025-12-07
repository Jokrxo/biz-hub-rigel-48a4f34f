import * as React from "react";
import { Suspense, lazy } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { SupabaseSetup } from "./components/Setup/SupabaseSetup";
import { PageLoader } from "./components/ui/loading-spinner";
import { InstallPrompt } from "./components/PWA/InstallPrompt";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./components/ui/alert-dialog";

// Lazy load pages
const Transactions = lazy(() => import("./pages/Transactions"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Quotes = lazy(() => import("./pages/Quotes"));
const FixedAssets = lazy(() => import("./pages/FixedAssets"));
const TrialBalance = lazy(() => import("./pages/TrialBalance"));
const Reports = lazy(() => import("./pages/Reports"));
const Sales = lazy(() => import("./pages/Sales"));
const Purchase = lazy(() => import("./pages/Purchase"));
const Tax = lazy(() => import("./pages/Tax"));
const Customers = lazy(() => import("./pages/Customers"));
const Settings = lazy(() => import("./pages/Settings"));
const Bank = lazy(() => import("./pages/Bank"));
const Budget = lazy(() => import("./pages/Budget"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Loans = lazy(() => import("./pages/Loans"));
const Investments = lazy(() => import("./pages/Investments"));
const PaymentPortal = lazy(() => import("./pages/PaymentPortal"));
const License = lazy(() => import("./pages/License"));
const LicenseAdmin = lazy(() => import("./pages/LicenseAdmin"));
const Companies = lazy(() => import("./pages/Companies"));
import About from "./pages/About";
import Community from "./pages/Community";

const queryClient = new QueryClient();

// Supabase is preconfigured via integrations client; no env check needed
const isSupabaseConfigured = () => true;

const App = () => {
  // Show setup screen if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return <SupabaseSetup />;
  }

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          {(() => {
            const CookieConsentGate: React.FC = () => {
              const { user } = useAuth();
              const [open, setOpen] = React.useState(false);
              const getCookie = (name: string) => {
                try {
                  const pairs = document.cookie.split('; ').map((s) => s.split('='));
                  const found = pairs.find(([k]) => k === name);
                  return found ? decodeURIComponent(found[1] || '') : null;
                } catch { return null; }
              };
              const setCookie = (name: string, value: string, days: number) => {
                try {
                  const expires = new Date(Date.now() + days * 864e5).toUTCString();
                  const secure = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:' ? '; Secure' : '';
                  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
                } catch {}
              };
              React.useEffect(() => {
                if (user) {
                  const existing = getCookie('cookie_consent');
                  if (!existing) setOpen(true);
                }
              }, [user]);
              const accept = () => { setCookie('cookie_consent', 'accepted', 365); setOpen(false); };
              const decline = () => { setCookie('cookie_consent', 'declined', 365); setOpen(false); };
              return (
                <AlertDialog open={open} onOpenChange={setOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>We use cookies</AlertDialogTitle>
                      <AlertDialogDescription>
                        We use essential cookies to keep you signed in and operate the app. You can accept or decline optional cookies.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={decline}>Decline</AlertDialogCancel>
                      <AlertDialogAction onClick={accept}>Accept</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            };
            return <CookieConsentGate />;
          })()}
          {(() => {
            try {
              const saved = localStorage.getItem('app_theme');
              const html = document.documentElement;
              [
                "theme-corp-blue",
                "theme-fintech-green",
                "theme-premium-navy",
                "theme-neutral-enterprise",
                "theme-dark-pro",
                "theme-exec-gold",
                "theme-ocean-gradient",
                "theme-purple-digital",
                "theme-tech-silver",
                "theme-eco-green"
              ].forEach(c => html.classList.remove(c));
              if (saved === 'corp_blue') html.classList.add('theme-corp-blue');
              else if (saved === 'fintech_green') html.classList.add('theme-fintech-green');
              else if (saved === 'premium_navy') html.classList.add('theme-premium-navy');
              else if (saved === 'neutral_enterprise') html.classList.add('theme-neutral-enterprise');
              else if (saved === 'dark_pro') html.classList.add('theme-dark-pro');
              else if (saved === 'exec_gold') html.classList.add('theme-exec-gold');
              else if (saved === 'ocean_gradient') html.classList.add('theme-ocean-gradient');
              else if (saved === 'purple_digital') html.classList.add('theme-purple-digital');
              else if (saved === 'tech_silver') html.classList.add('theme-tech-silver');
              else if (saved === 'eco_green') html.classList.add('theme-eco-green');
            } catch {}
            return null;
          })()}
          <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/community" element={<Community />} />

            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/bank" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Bank /></Suspense></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Transactions /></Suspense></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Invoices /></Suspense></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Quotes /></Suspense></ProtectedRoute>} />
            <Route path="/fixed-assets" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><FixedAssets /></Suspense></ProtectedRoute>} />
            <Route path="/trial-balance" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><TrialBalance /></Suspense></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Reports /></Suspense></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Sales /></Suspense></ProtectedRoute>} />
            <Route path="/purchase" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Purchase /></Suspense></ProtectedRoute>} />
            <Route path="/tax" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Tax /></Suspense></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Customers /></Suspense></ProtectedRoute>} />
            <Route path="/budget" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Budget /></Suspense></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Loans /></Suspense></ProtectedRoute>} />
            <Route path="/investments" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Investments /></Suspense></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Payroll /></Suspense></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><PaymentPortal /></Suspense></ProtectedRoute>} />
            <Route path="/license" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><License /></Suspense></ProtectedRoute>} />
            <Route path="/license-admin" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><LicenseAdmin /></Suspense></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Companies /></Suspense></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><About /></Suspense></ProtectedRoute>} />
            <Route path="/about-us" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><About /></Suspense></ProtectedRoute>} />
            <Route path="/dashboard/about" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><About /></Suspense></ProtectedRoute>} />
            <Route path="/dashboard/about-us" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><About /></Suspense></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
          <InstallPrompt />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
