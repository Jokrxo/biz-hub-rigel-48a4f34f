import { 
  LayoutDashboard,  
  Receipt, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Calculator,
  Users,
  PieChart,
  CreditCard,
  Building2,
  Building,
  Wallet,
  BookOpen,
  Settings,
  Shield,
  HelpCircle,
  AlertCircle
} from "lucide-react";

export const navGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/" },
      { icon: Receipt, label: "Transactions", href: "/transactions" },
      { icon: Building, label: "Bank", href: "/bank" },
    ]
  },
  {
    title: "Accounting",
    items: [
      { icon: Receipt, label: "Tax", href: "/tax" },
      { icon: Building2, label: "Fixed Assets", href: "/fixed-assets" },
      { icon: Calculator, label: "Trial Balance", href: "/trial-balance" },
      { icon: BookOpen, label: "Journals", href: "/journals" },
      { icon: TrendingUp, label: "Financial Reports", href: "/reports" },
      { icon: Wallet, label: "Budget", href: "/budget" },
      { icon: CreditCard, label: "Loans", href: "/loans" },
      { icon: PieChart, label: "Investments", href: "/investments" },
      { icon: DollarSign, label: "Payroll", href: "/payroll" },
      { icon: AlertCircle, label: "Impairment", href: "/impairment" },
    ]
  },
  {
    title: "Sales & Purchase",
    items: [
      { icon: FileText, label: "Invoices", href: "/invoices" },
      { icon: FileText, label: "Quotes", href: "/quotes" },
      { icon: Users, label: "Customers", href: "/customers" },
      { icon: Users, label: "Suppliers", href: "/suppliers" },
      { icon: Receipt, label: "Expenses", href: "/expenses" },
      { icon: FileText, label: "Purchase Orders", href: "/purchase-orders" },
    ]
  },
  {
    title: "System",
    items: [
      { icon: Settings, label: "Settings", href: "/settings" },
      { icon: Building, label: "Companies", href: "/companies" },
      { icon: Shield, label: "License", href: "/license" },
      { icon: Users, label: "Community", href: "/community" },
      { icon: HelpCircle, label: "About", href: "/about" },
    ]
  }
];
