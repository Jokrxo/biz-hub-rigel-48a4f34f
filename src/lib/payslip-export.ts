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
  const dateStr = new Date(slip.period_end).toLocaleDateString('en-ZA');

  // Top header
  doc.setFontSize(18);
  doc.text(company.name || 'Company Name', 14, 16);
  doc.setFontSize(18);
  doc.text('PAYSLIP', 190, 16, { align: 'right' });
  doc.setFontSize(9);
  if (company.address) doc.text(company.address, 14, 22);
  let lineY = 28;
  if (company.phone) { doc.text(`Phone: ${company.phone}`, 14, lineY); lineY += 6; }
  if (company.email) { doc.text(`Email: ${company.email}`, 14, lineY); }

  // Info panels on the right
  const boxX = 120;
  const boxY = 22;
  const boxW = 76;
  const rowH = 8;
  doc.setFontSize(10);
  doc.setFillColor(235, 235, 235);
  doc.rect(boxX, boxY, boxW, rowH, 'F');
  doc.text('PAY DATE', boxX + 4, boxY + 5);
  doc.rect(boxX, boxY + rowH, boxW, rowH);
  doc.text(dateStr, boxX + boxW - 4, boxY + rowH + 5, { align: 'right' });
  doc.setFillColor(235, 235, 235);
  doc.rect(boxX, boxY + 2 * rowH, boxW, rowH, 'F');
  doc.text('PAY TYPE', boxX + 4, boxY + 2 * rowH + 5);
  doc.rect(boxX, boxY + 3 * rowH, boxW, rowH);
  doc.text('Monthly', boxX + boxW - 4, boxY + 3 * rowH + 5, { align: 'right' });
  doc.setFillColor(235, 235, 235);
  doc.rect(boxX, boxY + 4 * rowH, boxW, rowH, 'F');
  doc.text('PERIOD', boxX + 4, boxY + 4 * rowH + 5);
  doc.rect(boxX, boxY + 5 * rowH, boxW, rowH);
  doc.text(` ${new Date(slip.period_start).toLocaleDateString('en-ZA')} - ${dateStr}`, boxX + boxW - 4, boxY + 5 * rowH + 5, { align: 'right' });
  doc.setFillColor(235, 235, 235);
  doc.rect(boxX, boxY + 6 * rowH, boxW, rowH, 'F');
  doc.text('PAYROLL #', boxX + 4, boxY + 6 * rowH + 5);
  doc.rect(boxX, boxY + 7 * rowH, boxW, rowH);
  doc.text('—', boxX + boxW - 4, boxY + 7 * rowH + 5, { align: 'right' });
  doc.setFillColor(235, 235, 235);
  doc.rect(boxX, boxY + 8 * rowH, boxW, rowH, 'F');
  doc.text('TAX CODE', boxX + 4, boxY + 8 * rowH + 5);
  doc.rect(boxX, boxY + 9 * rowH, boxW, rowH);
  doc.text('—', boxX + boxW - 4, boxY + 9 * rowH + 5, { align: 'right' });

  // Employee information panel
  const infoY = boxY + 10 * rowH + 10;
  doc.setFillColor(200, 220, 240);
  doc.rect(14, infoY - 8, 90, 8, 'F');
  doc.setFontSize(10);
  doc.text('EMPLOYEE INFORMATION', 16, infoY - 3);
  doc.setFontSize(10);
  doc.text('Full Name', 14, infoY + 8);
  doc.setFont(undefined, 'bold');
  doc.text(slip.employee_name, 14, infoY + 14);
  doc.setFont(undefined, 'normal');
  const addr = company.address || '';
  if (addr) doc.text(addr, 14, infoY + 20);

  // Payment Method
  doc.text('Payment Method: EFT', 14, infoY + 30);

  // Earnings table with Hours, Rate, Current, YTD
  const det = slip.details || {};
  const earningsRows: Array<any[]> = [];
  // Standard/Base Pay
  earningsRows.push(['Standard Pay', det.hours ?? '', '', fmt(slip.gross - (det.overtime_amount ?? 0) - (Array.isArray(det.allowances) ? det.allowances.reduce((s, a) => s + (a.amount || 0), 0) : 0)), fmt(slip.gross)]);
  // Overtime
  if (det.overtime_hours || det.overtime_amount) earningsRows.push(['Overtime Pay', det.overtime_hours ?? '', '', fmt(det.overtime_amount ?? 0), fmt(det.overtime_amount ?? 0)]);
  // Allowances (aggregated)
  const allowTotal = (det.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  if (allowTotal) earningsRows.push(['Allowances', '', '', fmt(allowTotal), fmt(allowTotal)]);

  autoTable(doc, {
    startY: infoY + 36,
    head: [['EARNINGS', 'HOURS', 'RATE', 'CURRENT', 'YTD']],
    body: earningsRows.length ? earningsRows : [['-', '', '', 'R 0.00', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [180, 180, 180], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } }
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  // Gross Pay band
  doc.setFillColor(235, 235, 235);
  doc.rect(14, y, 180, 10, 'F');
  doc.setFontSize(11);
  doc.text('GROSS PAY', 16, y + 6);
  doc.text(fmt(slip.gross), 190, y + 6, { align: 'right' });

  // Deductions table
  const deductionsRows: Array<any[]> = [];
  deductionsRows.push(['PAYE Tax', fmt(slip.paye), fmt(slip.paye)]);
  deductionsRows.push(['UIF (Employee)', fmt(slip.uif_emp), fmt(slip.uif_emp)]);
  autoTable(doc, {
    startY: y + 14,
    head: [['DEDUCTIONS', 'CURRENT', 'YTD']],
    body: deductionsRows.length ? deductionsRows : [['-', 'R 0.00', 'R 0.00']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [180, 180, 180], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  const totalDeductions = (slip.paye || 0) + (slip.uif_emp || 0);
  doc.setFillColor(235, 235, 235);
  doc.rect(14, y, 180, 10, 'F');
  doc.setFontSize(11);
  doc.text('TOTAL DEDUCTIONS', 16, y + 6);
  doc.text(fmt(totalDeductions), 190, y + 6, { align: 'right' });

  // Net Pay band
  y += 14;
  doc.setFillColor(220, 220, 220);
  doc.rect(70, y, 124, 12, 'F');
  doc.setFontSize(12);
  doc.text('NET PAY', 76, y + 8);
  doc.text(fmt(slip.net), 190, y + 8, { align: 'right' });

  // Footer contact
  y += 20;
  doc.setFontSize(8);
  const contact = company.name ? `[${company.name}]` : '[Company]';
  doc.text(`If you have any questions about this payslip, please contact: ${contact}`, 14, y);

  return doc;
};