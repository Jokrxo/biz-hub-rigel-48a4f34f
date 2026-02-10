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
  AlertCircle,
  UserCog,
  Bot,
  List,
  Briefcase,
  QrCode,
  Palette,
  FileSpreadsheet,
  Construction,
  Landmark,
  ScrollText,
  BarChart4,
  Scale,
  Box,
  Truck,
  ShoppingCart,
  FileCheck,
  FileInput,
  FileOutput,
  Banknote,
  Percent,
  History,
  ClipboardList,
  UserPlus,
  Settings2
} from "lucide-react";

export interface NavItem {
  icon?: any;
  label: string;
  href?: string;
  items?: NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Settings",
    items: [
      {
        icon: UserCog,
        label: "Profile",
        items: [
          { label: "Sign-up Wizard", href: "/signup-wizard", icon: Construction },
          { label: "Import Statement", href: "/import-statement", icon: FileSpreadsheet },
          { label: "Company Profile", href: "/companies", icon: Building },
        ]
      },
      { icon: QrCode, label: "QR Code", href: "/qr-code" },
      { icon: HelpCircle, label: "Help", href: "/help" },
      { icon: Settings, label: "App Settings", href: "/settings" },
    ]
  },
  {
    title: "Financial Reports",
    items: [
      {
        icon: LayoutDashboard,
        label: "Financial Dashboard",
        items: [
          { label: "Bank Balance Movement", href: "/bank", icon: Landmark },
          { label: "Tax Dashboard", href: "/tax", icon: Receipt },
          { label: "Financial Analysis", href: "/financial-analysis", icon: TrendingUp },
        ]
      },
      {
        icon: FileText,
        label: "Financial Reports",
        items: [
          { label: "Income Statement", href: "/reports/income-statement" },
          { label: "Balance Sheet", href: "/reports/balance-sheet" },
          { label: "Cash Flow Statement", href: "/reports/cash-flow" },
          { label: "Statement of Changes in Equity", href: "/reports/changes-in-equity" },
          { label: "Notes to Financial Statements", href: "/reports/notes" },
          { label: "Fixed Asset Register", href: "/reports/fixed-asset-register" },
          { label: "Aged Debtors Analysis", href: "/reports/aged-debtors" },
          { label: "Aged Creditors Analysis", href: "/reports/aged-creditors" },
          { label: "Inventory Valuation", href: "/reports/inventory-valuation" },
          { label: "VAT Return", href: "/reports/vat-return" },
          { label: "Budget vs Actual", href: "/reports/budget-variance" },
        ]
      },
      { icon: PieChart, label: "Management Accounts", href: "/management-accounts" },
    ]
  },
  {
    title: "Monthly reports",
    items: [
      { icon: TrendingUp, label: "Income Statement", href: "/monthly-reports/income-statement" },
      { icon: Scale, label: "Balance Sheet", href: "/monthly-reports/balance-sheet" },
      { icon: Wallet, label: "Cash Flow", href: "/monthly-reports/cash-flow" },
      { icon: Calculator, label: "Trial Balance", href: "/monthly-reports/trial-balance" },
      { icon: BookOpen, label: "General Ledger", href: "/monthly-reports/general-ledger" },
    ]
  },
  {
    title: "Accountant",
    items: [
      { icon: LayoutDashboard, label: "Accountant Dashboard", href: "/accountant" },
      { icon: BookOpen, label: "Journals", href: "/journals" },
      { icon: List, label: "Accounting Cycle", href: "/accounting-cycle" },
    ]
  },
  {
    title: "Sales",
    items: [
      { icon: Users, label: "Customers", href: "/sales/customers" },
      { icon: FileText, label: "Quotations", href: "/sales/quotations" },
      { icon: FileCheck, label: "Invoices", href: "/sales/invoices" },
      { icon: FileInput, label: "Credit Notes", href: "/sales/credit-notes" },
      { icon: FileOutput, label: "Receipts", href: "/sales/receipts" },
    ]
  },
  {
    title: "Purchase",
    items: [
      { icon: Truck, label: "Suppliers", href: "/purchase/suppliers" },
      { icon: ShoppingCart, label: "Purchase Orders", href: "/purchase/orders" },
      { icon: Receipt, label: "Supplier Invoices", href: "/purchase/invoices" },
      { icon: Banknote, label: "Payments", href: "/purchase/payments" },
      { icon: FileInput, label: "Supplier Credit Notes", href: "/purchase/credit-notes" },
    ]
  },
  {
    title: "Payroll",
    items: [
      { icon: DollarSign, label: "Run Payroll", href: "/payroll/run" },
      { icon: Users, label: "Employees", href: "/payroll/employees" },
      { icon: FileText, label: "Payslips", href: "/payroll/payslips" },
      { icon: Settings2, label: "Payroll Settings", href: "/payroll/settings" },
    ]
  }
];
