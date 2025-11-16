import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface QuoteForPDF {
  quote_number: string;
  quote_date: string;
  expiry_date: string | null;
  customer_name: string;
  customer_email: string | null;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export interface QuoteItemForPDF {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export interface CompanyForPDF {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_number?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
}

export const buildQuotePDF = (
  quote: QuoteForPDF,
  items: QuoteItemForPDF[],
  company: CompanyForPDF
) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(company.name || 'Company', 14, 18);
  doc.setFontSize(12);
  doc.text(`Quote ${quote.quote_number}`, 14, 26);
  doc.setFontSize(10);
  doc.text(`Date: ${new Date(quote.quote_date).toLocaleDateString('en-ZA')}`, 14, 33);
  if (quote.expiry_date) doc.text(`Expiry: ${new Date(quote.expiry_date).toLocaleDateString('en-ZA')}`, 14, 38);
  doc.text(`Customer: ${quote.customer_name}`, 14, 44);

  const tableBody = items.map(it => [
    it.description,
    it.quantity,
    it.unit_price.toFixed(2),
    `${it.tax_rate}%`,
    (it.quantity * it.unit_price).toFixed(2)
  ]);

  autoTable(doc, {
    head: [["Description","Qty","Unit Price","Tax %","Line Total"]],
    body: tableBody,
    startY: 50,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  const y = (doc as any).lastAutoTable.finalY || 50;
  doc.setFontSize(12);
  doc.text('Totals', 14, y + 10);
  doc.setFontSize(10);
  doc.text(`Subtotal: R ${quote.subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, y + 16);
  doc.text(`Tax: R ${quote.tax_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, y + 22);
  doc.text(`Total: R ${quote.total_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, y + 28);
  if (quote.notes) {
    doc.text('Notes:', 14, y + 36);
    doc.setFontSize(9);
    doc.text(String(quote.notes), 14, y + 42);
  }
  return doc;
};

export const exportQuoteToPDF = (
  quote: QuoteForPDF,
  items: QuoteItemForPDF[],
  company: CompanyForPDF,
  filename?: string
) => {
  const doc = buildQuotePDF(quote, items, company);
  doc.save(`${filename || `quote_${quote.quote_number}`}.pdf`);
};