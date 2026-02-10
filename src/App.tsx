import * as React from "react";
import { Suspense, lazy } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./context/AuthContext";
import { LayoutProvider } from "./context/LayoutContext";
import { useAuth } from "./context/useAuth";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { AppShell } from "./components/Layout/AppShell";
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
const CreditNotes = lazy(() => import("./pages/CreditNotes"));
const Receipts = lazy(() => import("./pages/Receipts"));
const Settings = lazy(() => import("./pages/Settings"));
const Bank = lazy(() => import("./pages/Bank"));
const Budget = lazy(() => import("./pages/Budget"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Loans = lazy(() => import("./pages/Loans"));
const Investments = lazy(() => import("./pages/Investments"));
const Impairment = lazy(() => import("./pages/Impairment"));
const PaymentPortal = lazy(() => import("./pages/PaymentPortal"));
const License = lazy(() => import("./pages/License"));
const LicenseAdmin = lazy(() => import("./pages/LicenseAdmin"));
const Companies = lazy(() => import("./pages/Companies"));
const Journals = lazy(() => import("./pages/Journals"));
const AccountantDashboard = lazy(() => import("./pages/AccountantDashboard"));
import About from "./pages/About";
import Community from "./pages/Community";
import PlaceholderPage from "./pages/Placeholder";

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
      <LayoutProvider>
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

            <Route element={<ProtectedRoute><AppShell><Outlet /></AppShell></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Index />} />
              
              {/* Settings Group */}
              <Route path="/signup-wizard" element={<PlaceholderPage />} />
              <Route path="/import-statement" element={<PlaceholderPage />} />
              <Route path="/companies" element={<Suspense fallback={<PageLoader />}><Companies /></Suspense>} />
              <Route path="/qr-code" element={<PlaceholderPage />} />
              <Route path="/help" element={<PlaceholderPage />} />
              <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              
              {/* Financial Reports Group */}
              <Route path="/bank" element={<Suspense fallback={<PageLoader />}><Bank /></Suspense>} />
              <Route path="/tax" element={<Suspense fallback={<PageLoader />}><Tax /></Suspense>} />
              <Route path="/financial-analysis" element={<PlaceholderPage />} />
              <Route path="/management-accounts" element={<PlaceholderPage />} />
              <Route path="/reports/income-statement" element={<PlaceholderPage />} />
              <Route path="/reports/balance-sheet" element={<PlaceholderPage />} />
              <Route path="/reports/cash-flow" element={<PlaceholderPage />} />
              <Route path="/reports/changes-in-equity" element={<PlaceholderPage />} />
              <Route path="/reports/notes" element={<PlaceholderPage />} />
              <Route path="/reports/fixed-asset-register" element={<Suspense fallback={<PageLoader />}><FixedAssets /></Suspense>} />
              <Route path="/reports/aged-debtors" element={<PlaceholderPage />} />
              <Route path="/reports/aged-creditors" element={<PlaceholderPage />} />
              <Route path="/reports/inventory-valuation" element={<PlaceholderPage />} />
              <Route path="/reports/vat-return" element={<PlaceholderPage />} />
              <Route path="/reports/budget-variance" element={<PlaceholderPage />} />
              
              {/* Monthly Reports Group */}
              <Route path="/monthly-reports/income-statement" element={<PlaceholderPage />} />
              <Route path="/monthly-reports/balance-sheet" element={<PlaceholderPage />} />
              <Route path="/monthly-reports/cash-flow" element={<PlaceholderPage />} />
              <Route path="/monthly-reports/trial-balance" element={<Suspense fallback={<PageLoader />}><TrialBalance /></Suspense>} />
              <Route path="/monthly-reports/general-ledger" element={<PlaceholderPage />} />
              
              {/* Accountant Group */}
              <Route path="/accountant" element={<Suspense fallback={<PageLoader />}><AccountantDashboard /></Suspense>} />
              <Route path="/journals" element={<Suspense fallback={<PageLoader />}><Journals /></Suspense>} />
              <Route path="/accounting-cycle" element={<PlaceholderPage />} />
              
              {/* Sales Group */}
              <Route path="/sales" element={<Suspense fallback={<PageLoader />}><Sales /></Suspense>} />
              <Route path="/sales/customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
              <Route path="/sales/quotations" element={<Suspense fallback={<PageLoader />}><Quotes /></Suspense>} />
              <Route path="/sales/invoices" element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
              <Route path="/sales/credit-notes" element={<Suspense fallback={<PageLoader />}><CreditNotes /></Suspense>} />
              <Route path="/sales/receipts" element={<Suspense fallback={<PageLoader />}><Receipts /></Suspense>} />
              
              {/* Purchase Group */}
              <Route path="/purchase" element={<Suspense fallback={<PageLoader />}><Purchase /></Suspense>} />
              <Route path="/purchase/suppliers" element={<PlaceholderPage />} />
              <Route path="/purchase/orders" element={<PlaceholderPage />} />
              <Route path="/purchase/invoices" element={<PlaceholderPage />} />
              <Route path="/purchase/payments" element={<PlaceholderPage />} />
              <Route path="/purchase/credit-notes" element={<PlaceholderPage />} />
              
              {/* Payroll Group */}
              <Route path="/payroll" element={<Suspense fallback={<PageLoader />}><Payroll /></Suspense>} />
              <Route path="/payroll/run" element={<PlaceholderPage />} />
              <Route path="/payroll/employees" element={<PlaceholderPage />} />
              <Route path="/payroll/payslips" element={<PlaceholderPage />} />
              <Route path="/payroll/settings" element={<PlaceholderPage />} />

              {/* Other Existing Routes (kept for backward compatibility or direct access) */}
              <Route path="/transactions" element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
              <Route path="/invoices" element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
              <Route path="/quotes" element={<Suspense fallback={<PageLoader />}><Quotes /></Suspense>} />
              <Route path="/fixed-assets" element={<Suspense fallback={<PageLoader />}><FixedAssets /></Suspense>} />
              <Route path="/trial-balance" element={<Suspense fallback={<PageLoader />}><TrialBalance /></Suspense>} />
              <Route path="/reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
              <Route path="/customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
              <Route path="/budget" element={<Suspense fallback={<PageLoader />}><Budget /></Suspense>} />
              <Route path="/loans" element={<Suspense fallback={<PageLoader />}><Loans /></Suspense>} />
              <Route path="/investments" element={<Suspense fallback={<PageLoader />}><Investments /></Suspense>} />
              <Route path="/impairment" element={<Suspense fallback={<PageLoader />}><Impairment /></Suspense>} />
              <Route path="/billing" element={<Suspense fallback={<PageLoader />}><PaymentPortal /></Suspense>} />
              <Route path="/license" element={<Suspense fallback={<PageLoader />}><License /></Suspense>} />
              <Route path="/license-admin" element={<Suspense fallback={<PageLoader />}><LicenseAdmin /></Suspense>} />
              <Route path="/about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
              <Route path="/about-us" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
              <Route path="/dashboard/about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
              <Route path="/dashboard/about-us" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
          <InstallPrompt />
        </BrowserRouter>
      </AuthProvider>
      </LayoutProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
