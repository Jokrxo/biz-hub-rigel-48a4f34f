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
  const fmt = (n?: number) => `R ${(n ?? 0).toFixed(2)}`;
  const payDate = new Date(slip.period_end).toLocaleDateString('en-ZA');
  doc.setFontSize(18);
  doc.text('PAYSLIP', 190, 16, { align: 'right' });
  doc.setFontSize(14);
  doc.text(company.name || 'Company', 14, 16);
  doc.setFontSize(9);
  if (company.address) doc.text(company.address, 14, 22);
  if (company.phone) doc.text(`P: ${company.phone}`, 14, 28);
  if (company.email) doc.text(`E: ${company.email}`, 14, 34);
  doc.setFontSize(10);
  const metaY = 46;
  doc.text(`Employee: ${slip.employee_name}`, 14, metaY);
  doc.text(`Period: ${new Date(slip.period_start).toLocaleDateString('en-ZA')} - ${payDate}`, 14, metaY + 6);
  doc.text(`Pay date: ${payDate}`, 14, metaY + 12);
  const det = slip.details || {} as any;
  const earningsList: Array<any[]> = [];
  const base = Math.max(0, (slip.gross || 0) - (det.overtime_amount || 0) - ((det.allowances || []).reduce((s: number, a: any) => s + (a.amount || 0), 0)));
  if (base > 0) earningsList.push(['Basic Salary', fmt(base)]);
  const allowTotal = (det.allowances || []).reduce((s: number, a: any) => s + (a.amount || 0), 0);
  if (allowTotal > 0) earningsList.push(['Allowances', fmt(allowTotal)]);
  if ((det.overtime_amount || 0) > 0) earningsList.push(['Overtime', fmt(det.overtime_amount || 0)]);
  if ((det.bonuses || 0) > 0) earningsList.push(['Bonus', fmt(det.bonuses || 0)]);
  const deductionsList: Array<any[]> = [];
  if ((slip.paye || 0) > 0) deductionsList.push(['PAYE', fmt(slip.paye)]);
  if ((slip.uif_emp || 0) > 0) deductionsList.push(['UIF (Employee)', fmt(slip.uif_emp)]);
  const otherDeds = Array.isArray(det.deductions) ? det.deductions.filter((d: any) => !String(d.name || '').toLowerCase().includes('paye') && !String(d.name || '').toLowerCase().includes('uif')) : [];
  otherDeds.forEach((d: any) => deductionsList.push([String(d.name || 'Deduction'), fmt(Number(d.amount || 0))]));
  autoTable(doc, {
    startY: metaY + 20,
    head: [['Earnings', 'Amount']],
    body: earningsList.length ? earningsList : [['-', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14 },
    tableWidth: 90
  });
  const rightStartY = metaY + 20;
  autoTable(doc, {
    startY: rightStartY,
    head: [['Deductions', 'Amount']],
    body: deductionsList.length ? deductionsList : [['-', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 114 },
    tableWidth: 80
  });
  let y = Math.max((doc as any).lastAutoTable.finalY, (doc as any).lastAutoTable.finalY) + 8;
  doc.setFontSize(10);
  doc.text('Gross Pay', 14, y);
  doc.text(fmt(slip.gross), 60, y, { align: 'right' });
  y += 6;
  const totalDeds = (slip.paye || 0) + (slip.uif_emp || 0) + otherDeds.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  doc.text('Total Deductions', 14, y);
  doc.text(fmt(totalDeds), 60, y, { align: 'right' });
  y += 8;
  doc.setFontSize(12);
  doc.text('Net Pay', 14, y);
  doc.text(fmt(slip.net), 60, y, { align: 'right' });
  y += 10;
  const contribRows: Array<any[]> = [];
  if ((slip.uif_er || 0) > 0) contribRows.push(['UIF (Employer)', fmt(slip.uif_er)]);
  if ((slip.sdl_er || 0) > 0) contribRows.push(['SDL (Employer)', fmt(slip.sdl_er)]);
  if (contribRows.length) {
    autoTable(doc, {
      startY: y,
      head: [['Employer Contributions', 'Amount']],
      body: contribRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 114 },
      tableWidth: 80
    });
  }
  return doc;
};
