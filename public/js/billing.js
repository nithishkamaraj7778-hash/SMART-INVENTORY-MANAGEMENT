// ==========================================
// Smart Inventory Management - billing.js
// ==========================================

let allProducts = [];
let billItems = [];
let selectedProduct = null;
let invoiceNumber = '';

function formatCurrency(value) {
  return Number(value || 0).toFixed(2);
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeInvoiceMeta();
  await loadProducts();
  bindEvents();
});

function initializeInvoiceMeta(dateObj = new Date()) {
  const now = dateObj;
  invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  document.getElementById('invoiceNumber').value = invoiceNumber;
  document.getElementById('invoiceDate').value = now.toLocaleDateString();
  document.getElementById('invoiceTime').value = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getInvoiceTimestamp() {
  const date = document.getElementById('invoiceDate').value;
  const time = document.getElementById('invoiceTime').value;
  return `${date} ${time}`;
}

function buildPrintInvoice(bill, customerName, customerPhone, paymentMethod, cashReceived, balance, invoiceId) {
  const invoiceNumberToShow = invoiceId || document.getElementById('invoiceNumber').value;
  const totals = calculateTotals();
  const rowsHtml = bill.map((item, index) => {
    const lineSubtotal = (item.price * item.quantity) - ((item.price * item.quantity) * (item.discountPercent / 100));
    const gstValue = lineSubtotal * (item.gstPercent / 100);
    const total = lineSubtotal + gstValue;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>₹${formatCurrency(item.price)}</td>
        <td>${item.discountPercent}%</td>
        <td>${item.gstPercent}%</td>
        <td>₹${formatCurrency(total)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('printInvoiceArea').innerHTML = `
    <div style="max-width:800px;margin:auto;color:#111827;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h2 style="margin:0;">Smart Inventory POS</h2>
          <p style="margin:4px 0 0;color:#475569;">Supermarket Billing Invoice</p>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;">Invoice: ${invoiceNumberToShow}</div>
          <div>${getInvoiceTimestamp()}</div>
          <div>Cashier: ${document.getElementById('cashierName').value || 'Admin'}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:24px;">
        <div style="flex:1;">
          <strong>Customer</strong>
          <div>${customerName || 'Walk-in'}</div>
          <div>${customerPhone || '-'}</div>
        </div>
        <div style="flex:1;">
          <strong>Payment</strong>
          <div>${paymentMethod}</div>
          <div>Cash Received: ₹${formatCurrency(cashReceived)}</div>
          <div>Balance: ₹${formatCurrency(balance)}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f1f5f9;color:#0f172a;text-align:left;">
            <th style="padding:10px;border:1px solid #d1d5db;">#</th>
            <th style="padding:10px;border:1px solid #d1d5db;">Product</th>
            <th style="padding:10px;border:1px solid #d1d5db;">Qty</th>
            <th style="padding:10px;border:1px solid #d1d5db;">Price</th>
            <th style="padding:10px;border:1px solid #d1d5db;">Discount</th>
            <th style="padding:10px;border:1px solid #d1d5db;">GST</th>
            <th style="padding:10px;border:1px solid #d1d5db;">Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;gap:24px;font-size:16px;">
        <div style="min-width:260px;">
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Subtotal</span><strong>₹${formatCurrency(totals.subtotal)}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Discount</span><strong>₹${formatCurrency(totals.discount)}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>GST</span><strong>₹${formatCurrency(totals.gst)}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #d1d5db;font-size:18px;font-weight:700;"><span>Grand Total</span><strong>₹${formatCurrency(totals.grandTotal)}</strong></div>
        </div>
      </div>
      <div style="margin-top:18px;color:#475569;font-size:12px;">Thank you for shopping with us. Please keep this invoice for your records.</div>
    </div>
  `;
}

async function loadProducts() {
  showLoading(true);
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Unable to load products');
    allProducts = await response.json();
  } catch (error) {
    console.error(error);
    showToast('Unable to load products for billing.', 'error');
  } finally {
    showLoading(false);
  }
}

function bindEvents() {
  const searchInput = document.getElementById('productSearch');
  const suggestions = document.getElementById('suggestions');
  const addProductBtn = document.getElementById('addProductBtn');
  const clearBillBtn = document.getElementById('clearBillBtn');
  const completePaymentBtn = document.getElementById('completePaymentBtn');
  const printInvoiceBtn = document.getElementById('printInvoiceBtn');
  const paymentModal = document.getElementById('paymentModal');
  const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
  const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
  const cashReceivedInput = document.getElementById('cashReceived');
  const paymentMethodInput = document.getElementById('paymentMethod');
  const balanceReturnInput = document.getElementById('balanceReturn');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      suggestions.style.display = 'none';
      return;
    }

    const filtered = allProducts.filter((product) => {
      const name = `${product.name}`.toLowerCase();
      const code = `${product.id}`.toLowerCase();
      return name.includes(query) || code.includes(query);
    }).slice(0, 8);

    if (filtered.length === 0) {
      suggestions.innerHTML = '<div class="suggestion-item">No matching products found.</div>';
      suggestions.style.display = 'block';
      return;
    }

    suggestions.innerHTML = filtered.map((product) => `
      <div class="suggestion-item" data-id="${product.id}">
        <strong>${product.name}</strong><br>
        <span style="font-size:12px;color:#64748b;">Stock ${product.quantity} • ₹${product.price}</span>
      </div>
    `).join('');
    suggestions.style.display = 'block';
  });

  suggestions.addEventListener('click', (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    const productId = parseInt(item.getAttribute('data-id'), 10);
    const product = allProducts.find((entry) => entry.id === productId);
    if (!product) return;
    selectProduct(product);
    suggestions.style.display = 'none';
    searchInput.value = product.name;
  });

  addProductBtn.addEventListener('click', () => {
    if (!selectedProduct) {
      showToast('Select a product first.', 'warning');
      return;
    }

    const quantity = parseInt(document.getElementById('selectedQty').value, 10) || 1;
    const discountPercent = parseFloat(document.getElementById('selectedDiscount').value) || 0;
    const gstPercent = parseFloat(document.getElementById('selectedGst').value) || 0;

    if (quantity <= 0) {
      showToast('Quantity must be greater than zero.', 'warning');
      return;
    }

    if (selectedProduct.quantity <= 0) {
      showToast('Out of Stock', 'error');
      return;
    }

    if (quantity > selectedProduct.quantity) {
      showToast(`Only ${selectedProduct.quantity} items available.`, 'warning');
      return;
    }

    const existingItem = billItems.find((entry) => entry.productId === selectedProduct.id);
    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > selectedProduct.quantity) {
        showToast(`Only ${selectedProduct.quantity} items available.`, 'warning');
        existingItem.quantity = selectedProduct.quantity;
      }
    } else {
      billItems.push({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        price: Number(selectedProduct.price),
        quantity,
        discountPercent,
        gstPercent
      });
    }

    renderBill();
    showToast(`${selectedProduct.name} added to the bill.`, 'success');
  });

  clearBillBtn.addEventListener('click', () => {
    billItems = [];
    renderBill();
    showToast('Bill cleared.', 'info');
  });

  completePaymentBtn.addEventListener('click', () => {
    if (billItems.length === 0) {
      showToast('Add at least one product to complete payment.', 'warning');
      return;
    }
    paymentModal.style.display = 'flex';
    const grandTotal = calculateTotals().grandTotal;
    document.getElementById('cashReceived').value = formatCurrency(grandTotal);
    updateBalance();
  });

  cancelPaymentBtn.addEventListener('click', () => {
    paymentModal.style.display = 'none';
  });

  confirmPaymentBtn.addEventListener('click', async () => {
    const totals = calculateTotals();
    const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
    const paymentMethod = document.getElementById('paymentMethod').value;

    if (cashReceived < totals.grandTotal) {
      showToast('Cash received is less than the grand total.', 'warning');
      return;
    }

    showLoading(true);
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: billItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discountPercent: item.discountPercent,
            gstPercent: item.gstPercent
          })),
          customerName: document.getElementById('customerName').value.trim(),
          customerPhone: document.getElementById('customerPhone').value.trim(),
          paymentMethod,
          cashReceived
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Billing failed');
      }

      const currentInvoiceNumber = data.sale.invoiceNumber;
      const paymentTime = new Date();
      initializeInvoiceMeta(paymentTime);
      const balance = cashReceived - totals.grandTotal;
      buildPrintInvoice(billItems, document.getElementById('customerName').value.trim(), document.getElementById('customerPhone').value.trim(), paymentMethod, cashReceived, balance, currentInvoiceNumber);
      showToast(`Invoice ${data.sale.invoiceNumber} completed successfully.`, 'success');
      billItems = [];
      renderBill();
      paymentModal.style.display = 'none';
      document.getElementById('customerName').value = '';
      document.getElementById('customerPhone').value = '';
      document.getElementById('cashReceived').value = '';
      await loadProducts();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to complete payment.', 'error');
    } finally {
      showLoading(false);
    }
  });

  cashReceivedInput.addEventListener('input', updateBalance);
  paymentMethodInput.addEventListener('change', updateBalance);

  printInvoiceBtn.addEventListener('click', () => {
    if (billItems.length === 0) {
      showToast('Nothing to print yet.', 'warning');
      return;
    }
    buildPrintInvoice(
      billItems,
      document.getElementById('customerName').value.trim(),
      document.getElementById('customerPhone').value.trim(),
      document.getElementById('paymentMethod').value,
      parseFloat(document.getElementById('cashReceived').value) || 0,
      parseFloat(document.getElementById('balanceReturn').value) || 0,
      document.getElementById('invoiceNumber').value
    );
    window.print();
  });
}

function selectProduct(product) {
  selectedProduct = product;
  document.getElementById('selectedProductName').value = product.name;
  document.getElementById('selectedPrice').value = formatCurrency(product.price);
  document.getElementById('selectedQuantity').value = product.quantity;
  document.getElementById('selectedQty').value = 1;
  document.getElementById('selectedDiscount').value = 0;
  document.getElementById('selectedGst').value = product.gst || 0;
}

function renderBill() {
  const tbody = document.getElementById('billItemsBody');
  const totals = calculateTotals();

  if (billItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;">No items added yet.</td></tr>';
  } else {
    tbody.innerHTML = billItems.map((item, index) => {
      const lineSubtotal = (item.price * item.quantity) - ((item.price * item.quantity) * (item.discountPercent / 100));
      const gstValue = lineSubtotal * (item.gstPercent / 100);
      const total = lineSubtotal + gstValue;
      return `
        <tr>
          <td>${item.productName}</td>
          <td>${formatCurrency(item.price)}</td>
          <td><input type="number" min="1" value="${item.quantity}" onchange="updateItemQty(${index}, this.value)" style="width:70px;padding:6px;border:1px solid #dbe2ea;border-radius:8px;" /></td>
          <td>${item.discountPercent}</td>
          <td>${item.gstPercent}</td>
          <td>${formatCurrency(total)}</td>
          <td><button class="danger" onclick="removeItem(${index})" style="padding:6px 10px;border:0;border-radius:8px;color:white;">Remove</button></td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('subtotalDisplay').textContent = formatCurrency(totals.subtotal);
  document.getElementById('discountDisplay').textContent = formatCurrency(totals.discount);
  document.getElementById('gstDisplay').textContent = formatCurrency(totals.gst);
  document.getElementById('grandTotalDisplay').textContent = formatCurrency(totals.grandTotal);
}

function calculateTotals() {
  let subtotal = 0;
  let discount = 0;
  let gst = 0;

  billItems.forEach((item) => {
    const lineSubtotal = item.price * item.quantity;
    const lineDiscount = lineSubtotal * (item.discountPercent / 100);
    const discountedSubtotal = lineSubtotal - lineDiscount;
    const lineGst = discountedSubtotal * (item.gstPercent / 100);
    subtotal += lineSubtotal;
    discount += lineDiscount;
    gst += lineGst;
  });

  return {
    subtotal,
    discount,
    gst,
    grandTotal: subtotal - discount + gst
  };
}

function updateItemQty(index, value) {
  const qty = parseInt(value, 10) || 1;
  billItems[index].quantity = qty;
  renderBill();
}

function removeItem(index) {
  billItems.splice(index, 1);
  renderBill();
}

function updateBalance() {
  const totals = calculateTotals();
  const received = parseFloat(document.getElementById('cashReceived').value) || 0;
  const balance = received - totals.grandTotal;
  document.getElementById('balanceReturn').value = formatCurrency(balance);
}
