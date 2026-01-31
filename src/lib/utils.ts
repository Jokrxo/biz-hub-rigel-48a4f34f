import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined) {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (val === null || val === undefined || isNaN(val)) return 'R 0.00';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val);
}

export function formatDate(dateStr: string, format: string = 'DD/MM/YYYY') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD/MM/YYYY':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}
