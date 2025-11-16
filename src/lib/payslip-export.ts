import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CompanyForPDF {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_number?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
}

export interface PayslipDetails {
  hours?: number;
  overtime_hours?: number;
  overtime_amount?: number;
  bonuses?: number;
  commission?: number;
  allowances?: Array<{ name: string; amount: number }>;
  deductions?: Array<{ name: string; amount: number }>;
}

export interface PayslipForPDF {
  period_start: string;
  period_end: string;
  employee_name: string;
  gross: number;
  net: number;
  paye: number;
  uif_emp: number;
  uif_er: number;
  sdl_er: number;
  details?: PayslipDetails | null;
}

export const buildPayslipPDF = (
  slip: PayslipForPDF,
  company: CompanyForPDF
) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('PAYSLIP', 180, 18, { align: 'right' });
  doc.setFontSize(14);
  doc.text(company.name || 'Company', 14, 18);
  doc.setFontSize(10);
  if (company.address) doc.text(company.address, 14, 24);
  if (company.phone) doc.text(`P: ${company.phone}`, 14, 30);
  if (company.email) doc.text(`E: ${company.email}`, 14, 36);

  // Meta
  const metaY = 48;
  doc.setFontSize(11);
  doc.text(`Employee: ${slip.employee_name}`, 14, metaY);
  doc.text(`Period: ${new Date(slip.period_start).toLocaleDateString('en-ZA')} - ${new Date(slip.period_end).toLocaleDateString('en-ZA')}`, 14, metaY + 6);

  // Earnings & Deductions table
  const earnings: Array<[string, string]> = [];
  const deductions: Array<[string, string]> = [];
  const det = slip.details || {};
  const fmt = (n?: number) => `R ${(n ?? 0).toFixed(2)}`;

  if (det.hours) earnings.push(['Base Hours', String(det.hours)]);
  if (det.overtime_hours) earnings.push(['Overtime Hours', String(det.overtime_hours)]);
  if (det.overtime_amount) earnings.push(['Overtime Amount', fmt(det.overtime_amount)]);
  if (det.bonuses) earnings.push(['Bonuses', fmt(det.bonuses)]);
  if (det.commission) earnings.push(['Commission', fmt(det.commission)]);
  (det.allowances || []).forEach(a => earnings.push([`Allowance: ${a.name}`, fmt(a.amount)]));

  deductions.push(['PAYE', fmt(slip.paye)]);
  deductions.push(['UIF (Employee)', fmt(slip.uif_emp)]);
  (det.deductions || []).forEach(d => deductions.push([`Deduction: ${d.name}`, fmt(d.amount)]));

  autoTable(doc, {
    startY: metaY + 10,
    head: [['Earnings', 'Amount']],
    body: earnings.length ? earnings : [['-', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } }
  });

  const y1 = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: y1,
    head: [['Deductions', 'Amount']],
    body: deductions.length ? deductions : [['-', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [220, 20, 60], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } }
  });

  // Employer contributions
  let y2 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text('Employer Contributions', 14, y2);
  doc.setFontSize(10);
  y2 += 6;
  doc.text(`UIF (Employer): ${fmt(slip.uif_er)}`, 14, y2);
  y2 += 6;
  doc.text(`SDL: ${fmt(slip.sdl_er)}`, 14, y2);

  // Totals
  y2 += 10;
  doc.setFontSize(12);
  doc.text('Totals', 14, y2);
  doc.setFontSize(10);
  y2 += 6;
  doc.text(`Gross: ${fmt(slip.gross)}`, 14, y2);
  y2 += 6;
  doc.text(`Net Pay: ${fmt(slip.net)}`, 14, y2);

  return doc;
};