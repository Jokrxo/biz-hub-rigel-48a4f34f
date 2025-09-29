import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TrialBalance } from '@/types/trial-balance';

export const exportToExcel = (data: TrialBalance[], filename = 'trial_balance') => {
  const exportData = data.map(entry => ({
    'Account Code': entry.account_code,
    'Account Name': entry.account_name,
    'Debit': entry.debit,
    'Credit': entry.credit,
  }));

  const totalDebits = data.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredits = data.reduce((sum, entry) => sum + entry.credit, 0);
  
  exportData.push({ 'Account Code': '', 'Account Name': 'TOTALS', 'Debit': totalDebits, 'Credit': totalCredits });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial Balance');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (data: TrialBalance[], filename = 'trial_balance') => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text('Trial Balance', 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  const tableData = data.map(entry => [entry.account_code, entry.account_name, entry.debit.toFixed(2), entry.credit.toFixed(2)]);
  const totalDebits = data.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredits = data.reduce((sum, entry) => sum + entry.credit, 0);
  tableData.push(['', 'TOTALS', totalDebits.toFixed(2), totalCredits.toFixed(2)]);

  autoTable(doc, {
    head: [['Account Code', 'Account Name', 'Debit', 'Credit']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (data) => { if (data.row.index === tableData.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [255, 215, 0]; } },
  });
  doc.save(`${filename}.pdf`);
};

// Transactions export
export interface ExportableTransaction { date: string; description: string; type: string; amount: number; vatAmount?: number; reference?: string }

export const exportTransactionsToExcel = (rows: ExportableTransaction[], filename = 'transactions') => {
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    Date: r.date,
    Description: r.description,
    Type: r.type,
    Amount: r.amount,
    VAT: r.vatAmount ?? r.amount * 0.15,
    Reference: r.reference ?? ''
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportTransactionsToPDF = (rows: ExportableTransaction[], filename = 'transactions') => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Transactions', 14, 18);
  const body = rows.map(r => [r.date, r.description, r.type, r.amount.toFixed(2), ((r.vatAmount ?? r.amount * 0.15)).toFixed(2), r.reference ?? '']);
  autoTable(doc, { head: [['Date','Description','Type','Amount','VAT','Reference']], body, startY: 26 });
  doc.save(`${filename}.pdf`);
};