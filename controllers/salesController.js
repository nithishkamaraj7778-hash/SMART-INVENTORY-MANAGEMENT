const db = require('../database/db');
const PDFDocument = require('pdfkit');

function formatCurrency(value) {
  return Number(value || 0).toFixed(2);
}

async function getSaleByIdHelper(id) {
  const saleRows = await db.query('SELECT * FROM sales WHERE id = ?', [id]);
  if (saleRows.length === 0) return null;
  const items = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
  return { ...saleRows[0], items };
}

// Fetch all sales for the sales history page.
exports.getSales = async (req, res) => {
  try {
    const sales = await db.query('SELECT * FROM sales ORDER BY created_at DESC');
    const detailedSales = [];

    for (const sale of sales) {
      const items = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      detailedSales.push({
        id: sale.id,
        invoice_number: sale.invoice_number,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        payment_method: sale.payment_method,
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
        cash_received: sale.cash_received,
        balance: sale.balance,
        created_at: sale.created_at,
        items_count: items.length,
        items,
        status: 'Paid'
      });
    }

    return res.json(detailedSales);
  } catch (error) {
    console.error('Error loading sales history:', error);
    return res.status(500).json({ message: 'Failed to load sales history.' });
  }
};

// Fetch the line items for a sale.
exports.getSaleItemsBySaleId = async (req, res) => {
  try {
    const sale = await getSaleByIdHelper(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    return res.json(sale.items);
  } catch (error) {
    console.error('Error loading sale items:', error);
    return res.status(500).json({ message: 'Unable to load sale items.' });
  }
};

// Fetch a single sale and its items.
exports.getSaleById = async (req, res) => {
  try {
    const sale = await getSaleByIdHelper(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    return res.json(sale);
  } catch (error) {
    console.error('Error loading sale details:', error);
    return res.status(500).json({ message: 'Failed to load invoice details.' });
  }
};

// Return sale invoice data for print preview.
exports.printSale = async (req, res) => {
  try {
    const sale = await getSaleByIdHelper(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    return res.json({ success: true, sale });
  } catch (error) {
    console.error('Error preparing print data:', error);
    return res.status(500).json({ message: 'Failed to prepare print data.' });
  }
};

// Generate PDF for a sale invoice.
exports.pdfSale = async (req, res) => {
  try {
    const sale = await getSaleByIdHelper(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const invoiceFilename = `Invoice_${sale.invoice_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceFilename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    doc.fillColor('#151515').fontSize(18).font('Helvetica-Bold').text('Smart Inventory POS', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#5b6770');
    doc.text('123 Retail Avenue, Market City, 400001', { lineGap: 2 });
    doc.text('GSTIN: 27AAEPM1234Q1ZV');
    doc.text('Phone: +91 98765 43210');
    doc.moveDown(1);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);

    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text(`Invoice: ${sale.invoice_number}`, { continued: true });
    doc.font('Helvetica').text(`   Date: ${sale.created_at}`);
    doc.text(`Cashier: Admin   Payment: ${sale.payment_method}`);
    doc.text(`Customer: ${sale.customer_name || 'Walk-in Customer'}   Phone: ${sale.customer_phone || '-'}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold');
    doc.text('Sl No', 40, doc.y, { continued: true, width: 40 });
    doc.text('Product', 80, doc.y, { continued: true, width: 180 });
    doc.text('Price', 260, doc.y, { continued: true, width: 60, align: 'right' });
    doc.text('Qty', 320, doc.y, { continued: true, width: 40, align: 'right' });
    doc.text('Discount', 360, doc.y, { continued: true, width: 70, align: 'right' });
    doc.text('GST', 430, doc.y, { continued: true, width: 50, align: 'right' });
    doc.text('Amount', 490, doc.y, { width: 65, align: 'right' });
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();

    sale.items.forEach((item, index) => {
      const lineSubtotal = item.price * item.quantity;
      const lineDiscount = Number(item.discount) || 0; // monetary discount
      const discounted = lineSubtotal - lineDiscount;
      const gstValue = Number(item.gst) || 0; // monetary GST
      const amount = Number(item.subtotal) || (discounted + gstValue);

      doc.font('Helvetica').fontSize(10).fillColor('#111827');
      doc.text(`${index + 1}`, 40, doc.y, { continued: true, width: 40 });
      doc.text(item.product_name, 80, doc.y, { continued: true, width: 180 });
      doc.text(`₹${formatCurrency(item.price)}`, 260, doc.y, { continued: true, width: 60, align: 'right' });
      doc.text(item.quantity, 320, doc.y, { continued: true, width: 40, align: 'right' });
      doc.text(`₹${formatCurrency(lineDiscount)}`, 360, doc.y, { continued: true, width: 70, align: 'right' });
      doc.text(`₹${formatCurrency(gstValue)}`, 430, doc.y, { continued: true, width: 50, align: 'right' });
      doc.text(`₹${formatCurrency(amount)}`, 490, doc.y, { width: 65, align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    const summaryStart = doc.y;
    doc.fontSize(10).font('Helvetica').text('Subtotal', 380, summaryStart, { continued: true });
    doc.text(`₹${formatCurrency(sale.subtotal)}`, { align: 'right' });
    doc.text('Discount', 380, doc.y, { continued: true });
    doc.text(`₹${formatCurrency(sale.discount)}`, { align: 'right' });
    doc.text('GST', 380, doc.y, { continued: true });
    doc.text(`₹${formatCurrency(sale.gst)}`, { align: 'right' });
    doc.font('Helvetica-Bold').text('Grand Total', 380, doc.y, { continued: true });
    doc.text(`₹${formatCurrency(sale.grand_total)}`, { align: 'right' });
    doc.font('Helvetica').text('Cash Received', 380, doc.y, { continued: true });
    doc.text(`₹${formatCurrency(sale.cash_received)}`, { align: 'right' });
    doc.text('Balance Returned', 380, doc.y, { continued: true });
    doc.text(`₹${formatCurrency(sale.balance)}`, { align: 'right' });

    doc.moveDown(1);
    doc.text('Thank You for shopping with us.', { align: 'center' });
    doc.text('Visit Again', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#6b7280').text('Terms & Conditions: Goods once sold will not be taken back. Kindly verify items before leaving the store.', { align: 'center' });
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ message: 'Unable to generate invoice PDF.' });
  }
};

// Delete an invoice and restore the inventory stock for each line item.
exports.deleteSale = async (req, res) => {
  try {
    const saleRows = await db.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (saleRows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const items = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);

    await db.runInTransaction(async () => {
      for (const item of items) {
        await db.query('UPDATE product SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
      await db.query('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
      await db.query('DELETE FROM sales WHERE id = ?', [req.params.id]);
    });

    return res.json({ success: true, message: 'Invoice deleted and inventory restored.' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return res.status(500).json({ message: 'Unable to delete invoice.' });
  }
};
