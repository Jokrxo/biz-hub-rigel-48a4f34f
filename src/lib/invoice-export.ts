import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceForPDF {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  customer_name: string;
  customer_email?: string | null;
  notes?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
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

export interface InvoiceItemForPDF {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

export const buildInvoicePDF = (
  invoice: InvoiceForPDF,
  items: InvoiceItemForPDF[],
  company: CompanyForPDF
) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('en-ZA');

  // Header
  doc.setFontSize(22);
  doc.text('INVOICE', 180, 20, { align: 'right' });
  doc.setFontSize(14);
  doc.text(company.name || 'Company', 14, 20);
  doc.setFontSize(10);
  if (company.address) doc.text(company.address, 14, 26);
  if (company.phone) doc.text(`P: ${company.phone}`, 14, 32);
  if (company.email) doc.text(`E: ${company.email}`, 14, 38);

  // Invoice meta
  doc.setFontSize(10);
  const metaStartY = 50;
  doc.text(`Invoice #: ${invoice.invoice_number}`, 14, metaStartY);
  doc.text(`Invoice date: ${new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}`, 14, metaStartY + 6);
  doc.text(`Due date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-ZA') : 'NA'}`, 14, metaStartY + 12);
  doc.text(`Bill to: ${invoice.customer_name}`, 14, metaStartY + 18);
  if (invoice.customer_email) doc.text(`Email: ${invoice.customer_email}`, 14, metaStartY + 24);

  // Items table
  const body = items.map((it, idx) => {
    const price = it.quantity * it.unit_price;
    return [
      `A${String(idx + 1).padStart(3, '0')}`,
      it.description || '-',
      it.quantity,
      `R ${it.unit_price.toFixed(2)}`,
      'R 0.00',
      `R ${price.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: metaStartY + 32,
    head: [['Item #', 'Description', 'Qty', 'Unit price', 'Discount', 'Price']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  });

  // Totals box (right side)
  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text('Invoice Subtotal:', 140, y);
  doc.text(`R ${invoice.subtotal.toFixed(2)}`, 190, y, { align: 'right' });
  y += 6;
  doc.text('Tax Rate:', 140, y);
  const taxRate = items[0]?.tax_rate ?? 0;
  doc.text(`${taxRate.toFixed(0)}%`, 190, y, { align: 'right' });
  y += 6;
  doc.text('Sales Tax:', 140, y);
  doc.text(`R ${invoice.tax_amount.toFixed(2)}`, 190, y, { align: 'right' });
  y += 6;
  doc.text('Deposit Received:', 140, y);
  doc.text('R 0.00', 190, y, { align: 'right' });
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Total:', 140, y);
  doc.text(`R ${invoice.total_amount.toFixed(2)}`, 190, y, { align: 'right' });
  doc.setFont(undefined, 'normal');

  // Footer note
  y += 14;
  doc.setFontSize(9);
  doc.text('Please make all checks payable to ' + (company.name || 'Company'), 14, y);
  y += 6;
  doc.text('Total due in 30 days. Overdue accounts subject to a service charge of 1.5% per month.', 14, y);
  y += 6;
  doc.text(`Generated on ${today}`, 14, y);

  return doc;
};

export const exportInvoiceToPDF = (
  invoice: InvoiceForPDF,
  items: InvoiceItemForPDF[],
  company: CompanyForPDF,
  filename = `invoice_${invoice.invoice_number}`
) => {
  const doc = buildInvoicePDF(invoice, items, company);
  doc.save(`${filename}.pdf`);
};

export const addLogoToPDF = (doc: any, logoDataUrl: string) => {
  try {
    doc.addImage(logoDataUrl, 'PNG', 14, 8, 24, 24);
  } catch (e) {
    console.warn('Failed to add logo to PDF', e);
  }
};

// Fetch a logo image as Data URL suitable for jsPDF.addImage
export const fetchLogoDataUrl = async (logoUrl?: string | null): Promise<string> => {
  if (!logoUrl) return '';
  try {
    const resp = await fetch(logoUrl);
    if (!resp.ok) return '';
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read logo blob'));
      reader.onloadend = () => resolve((reader.result || '') as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to fetch logo for PDF', e);
    return '';
  }
};

export const buildInvoicePDFTemplate2 = (
  invoice: InvoiceForPDF,
  items: InvoiceItemForPDF[],
  company: CompanyForPDF
) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(company.name || 'Company', 14, 16);
  doc.setFontSize(10);
  const topRightY = 12;
  doc.text('INVOICE', 190, topRightY, { align: 'right' });
  doc.text(`Invoice #: ${invoice.invoice_number}`, 190, topRightY + 6, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}`, 190, topRightY + 12, { align: 'right' });
  if (company.address) doc.text(company.address, 14, 22);
  const metaStartY = 34;
  doc.text(`Bill to: ${invoice.customer_name}`, 14, metaStartY);
  if (invoice.customer_email) doc.text(`Email: ${invoice.customer_email}`, 14, metaStartY + 6);
  const body = items.map((it) => {
    const price = it.quantity * it.unit_price;
    const vat = (it.tax_rate ?? 0) / 100 * price;
    return [
      it.description || '-',
      it.quantity,
      `R ${it.unit_price.toFixed(2)}`,
      `R ${vat.toFixed(2)}`,
      `R ${price.toFixed(2)}`
    ];
  });
  autoTable(doc, {
    startY: metaStartY + 14,
    head: [['Description', 'Qty', 'Unit', 'VAT', 'Line Total']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
  });
  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setDrawColor(0);
  doc.rect(130, y, 70, 30);
  doc.setFontSize(10);
  doc.text('Subtotal', 134, y + 6);
  doc.text(`R ${invoice.subtotal.toFixed(2)}`, 194, y + 6, { align: 'right' });
  doc.text('VAT', 134, y + 12);
  doc.text(`R ${invoice.tax_amount.toFixed(2)}`, 194, y + 12, { align: 'right' });
  doc.setFont(undefined, 'bold');
  doc.text('Total', 134, y + 24);
  doc.text(`R ${invoice.total_amount.toFixed(2)}`, 194, y + 24, { align: 'right' });
  doc.setFont(undefined, 'normal');
  return doc;
};

export const buildInvoicePDFTemplate3 = (
  invoice: InvoiceForPDF,
  items: InvoiceItemForPDF[],
  company: CompanyForPDF
) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Invoice', 14, 16);
  doc.setFontSize(12);
  doc.text(company.name || 'Company', 14, 24);
  const rightY = 16;
  doc.text(`No: ${invoice.invoice_number}`, 190, rightY, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}`, 190, rightY + 6, { align: 'right' });
  if (invoice.due_date) doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString('en-ZA')}`, 190, rightY + 12, { align: 'right' });
  const metaStartY = 34;
  doc.setFontSize(10);
  doc.text(`Bill to: ${invoice.customer_name}`, 14, metaStartY);
  const body = items.map((it) => {
    const line = it.quantity * it.unit_price;
    const rate = it.tax_rate ?? 0;
    const vat = rate / 100 * line;
    const total = line + vat;
    return [
      it.description || '-',
      it.quantity,
      `R ${it.unit_price.toFixed(2)}`,
      `${rate.toFixed(0)}%`,
      `R ${vat.toFixed(2)}`,
      `R ${total.toFixed(2)}`
    ];
  });
  autoTable(doc, {
    startY: metaStartY + 8,
    head: [['Description', 'Qty', 'Unit', 'Tax', 'VAT', 'Total']],
    body,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  });
  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(10);
  doc.text('Subtotal', 140, y);
  doc.text(`R ${invoice.subtotal.toFixed(2)}`, 190, y, { align: 'right' });
  y += 6;
  doc.text('VAT', 140, y);
  doc.text(`R ${invoice.tax_amount.toFixed(2)}`, 190, y, { align: 'right' });
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Total', 140, y);
  doc.text(`R ${invoice.total_amount.toFixed(2)}`, 190, y, { align: 'right' });
  doc.setFont(undefined, 'normal');
  return doc;
};

export const buildInvoicePDFByTemplate = (
  template: string,
  invoice: InvoiceForPDF,
  items: InvoiceItemForPDF[],
  company: CompanyForPDF
) => {
  if (template === 'template2') return buildInvoicePDFTemplate2(invoice, items, company);
  if (template === 'template3') return buildInvoicePDFTemplate3(invoice, items, company);
  return buildInvoicePDF(invoice, items, company);
};
