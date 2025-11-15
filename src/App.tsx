import * as React from "react";
import { Suspense, lazy } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { SupabaseSetup } from "./components/Setup/SupabaseSetup";
import { PageLoader } from "./components/ui/loading-spinner";

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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

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
            <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
