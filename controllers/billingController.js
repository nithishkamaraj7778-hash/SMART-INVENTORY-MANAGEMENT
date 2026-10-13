const db = require('../database/db');

function generateInvoiceNumber() {
  const stamp = Date.now().toString();
  return `INV-${stamp.slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, maxLength = 100) {
  return String(value || '').trim().slice(0, maxLength);
}

// Create a new sales transaction and immediately reduce inventory stock.
exports.createSale = async (req, res) => {
  const {
    items = [],
    customerName = '',
    customerPhone = '',
    paymentMethod = 'Cash',
    cashReceived = 0
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one product is required.' });
  }

  try {
    const requestedItems = new Map();
    const allowedPaymentMethods = new Set(['Cash', 'Card', 'UPI', 'Credit']);

    if (!allowedPaymentMethods.has(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Choose a valid payment method.' });
    }

    for (const item of items) {
      const productId = Number.parseInt(item.productId, 10);
      const quantity = Number.parseInt(item.quantity, 10);
      const discountPercent = toNumber(item.discountPercent);

      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each item needs a valid product and quantity.' });
      }
      if (discountPercent < 0 || discountPercent > 100) {
        return res.status(400).json({ success: false, message: 'Discounts must be between 0 and 100 percent.' });
      }

      const existing = requestedItems.get(productId) || { quantity: 0, discountPercent };
      existing.quantity += quantity;
      existing.discountPercent = Math.max(existing.discountPercent, discountPercent);
      requestedItems.set(productId, existing);
    }

    const normalizedItems = [];
    let subtotal = 0;
    let discountTotal = 0;
    let gstTotal = 0;

    for (const [productId, requested] of requestedItems) {
      const quantity = requested.quantity;
      const discountPercent = requested.discountPercent;

      const productRows = await db.query('SELECT * FROM product WHERE id = ?', [productId]);
      const product = productRows[0];

      if (!product) {
        return res.status(404).json({ success: false, message: 'One or more products were not found.' });
      }

      const availableStock = Number.parseInt(product.quantity, 10) || 0;
      if (availableStock <= 0) {
        return res.status(409).json({ success: false, message: `Out of Stock: ${product.name}` });
      }

      if (quantity > availableStock) {
        return res.status(409).json({ success: false, message: `Only ${availableStock} items available for ${product.name}.` });
      }

      const unitPrice = toNumber(product.price);
      const gstPercent = toNumber(product.gst);
      const lineSubtotal = unitPrice * quantity;
      const lineDiscount = lineSubtotal * (discountPercent / 100);
      const discountedSubtotal = lineSubtotal - lineDiscount;
      const lineGst = discountedSubtotal * (gstPercent / 100);

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      gstTotal += lineGst;

      normalizedItems.push({
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        discountPercent,
        gstPercent,
        lineDiscount,
        lineGst,
        lineSubtotal: discountedSubtotal + lineGst
      });
    }

    const grandTotal = subtotal - discountTotal + gstTotal;
    const receivedAmount = toNumber(cashReceived);
    const balance = receivedAmount - grandTotal;
    const invoiceRef = generateInvoiceNumber();

    const sale = await db.runInTransaction(async () => {
      for (const item of normalizedItems) {
        const updateResult = await db.query(
          'UPDATE product SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          [item.quantity, item.productId, item.quantity]
        );
        if (!updateResult.affectedRows) {
          throw new Error(`Stock changed before billing completed for product ${item.productId}.`);
        }
      }

      const insertResult = await db.query(
        `INSERT INTO sales (invoice_number, customer_name, customer_phone, payment_method, subtotal, discount, gst, grand_total, cash_received, balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceRef,
          cleanText(customerName),
          cleanText(customerPhone, 50),
          paymentMethod,
          Number(subtotal.toFixed(2)),
          Number(discountTotal.toFixed(2)),
          Number(gstTotal.toFixed(2)),
          Number(grandTotal.toFixed(2)),
          Number(receivedAmount.toFixed(2)),
          Number(balance.toFixed(2))
        ]
      );

      const saleId = insertResult.insertId;
      for (const item of normalizedItems) {
        await db.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, price, quantity, gst, discount, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.productId, item.productName, item.unitPrice, item.quantity, item.lineGst, item.lineDiscount, item.lineSubtotal]
        );
      }

      return {
        id: saleId,
        invoiceNumber: invoiceRef,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        paymentMethod,
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discountTotal.toFixed(2)),
        gst: Number(gstTotal.toFixed(2)),
        grandTotal: Number(grandTotal.toFixed(2)),
        cashReceived: Number(receivedAmount.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        items: normalizedItems
      };
    });

    return res.status(201).json({ success: true, message: 'Payment completed successfully.', sale });
  } catch (error) {
    console.error('Billing error:', error);
    return res.status(500).json({ success: false, message: 'Unable to complete the billing transaction.' });
  }
};
