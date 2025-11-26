export const systemOverview = `
Rigel Business System Overview

Modules
- Dashboard: KPIs and recent activity
- Transactions: Income, Expense, Assets; VAT handling with Input/Output accounts
- Sales: Invoices, Quotes, AR aging
- Purchase: Bills, Product purchases, AP dashboard
- Bank: Accounts and balances
- Budget: Monthly budgets vs actuals from posted entries
- Tax: VAT Input/Output reports; purchases show net (excl. VAT) and VAT correctly
- Trial Balance: Summarizes debit/credit balances
- Reports: Financial statements and analytics
- Payroll, Loans, Fixed Assets, Customers, Settings

Key Behaviors
- Purchases use exclusive VAT: total = net + VAT; entries post VAT Input
- Invoices (sales) treat totals inclusive; entries post VAT Output
- VAT shown on Transactions list is from posted entries or stored vat_amount
- Aborted requests handled; counts use GET with limit(1)
- User tour shows once after first login; tutorial shows once after signup
- Themes: 10 palettes available under Settings → Theme

Accounting Helpers
- Unpaid invoices/bills can be counted via company-scoped queries
- Recent transactions listed by date desc with totals
- Budget actuals derive from posted entries in target month
- Trial Balance is a ledger view of account balances after postings
`;

export const accountingPrimer = `
Accounting Primer
- Assets = Liabilities + Equity
- Income increases equity; Expenses reduce equity
- VAT Input (on purchases) is receivable; VAT Output (on sales) is payable
- Exclusive VAT: VAT = Net × Rate; Inclusive VAT: VAT = Total × Rate/(1+Rate)
- Trial Balance lists account balances; debits on asset/expense, credits on liability/income
`;

