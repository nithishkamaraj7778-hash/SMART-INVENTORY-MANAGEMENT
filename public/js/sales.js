// ==========================================
// Smart Inventory Management - sales.js
// ==========================================

let salesData = [];
let currentPage = 1;
const pageSize = 10;
let currentInvoiceId = null;

function formatCurrency(value) {
  return Number(value || 0).toFixed(2);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSales();
  bindFilters();
});

async function loadSales() {
  showLoading(true);
  try {
    const response = await fetch('/api/sales');
    if (!response.ok) throw new Error('Unable to load sales history');
    salesData = await response.json();
    currentPage = 1;
    renderSummary(salesData);
    renderSales();
  } catch (error) {
    console.error(error);
    showToast('Unable to load sales history.', 'error');
  } finally {
    showLoading(false);
  }
}

function closeInvoiceModal() {
  const modal = document.getElementById('invoiceModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function renderInvoiceContent(sale) {
  const container = document.getElementById('invoiceDetailsContainer');
  if (!container) return;

  const rows = (sale.items || []).map((item, index) => {
    const lineDiscount = Number(item.discount) || 0;
    const gstValue = Number(item.gst) || 0;
    const total = Number(item.subtotal) || 0;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>₹${formatCurrency(item.price)}</td>
        <td>₹${formatCurrency(lineDiscount)}</td>
        <td>₹${formatCurrency(gstValue)}</td>
        <td>₹${formatCurrency(total)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="invoice-section">
      <div class="invoice-header">
        <div>
          <h2>Smart Inventory POS</h2>
          <p>Supermarket billing invoice</p>
          <p>Clean, saved invoice preview from SQLite sales history.</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;color:#64748b;">Invoice No. <strong>${sale.invoice_number}</strong></div>
          <div style="margin-top:8px;font-size:14px;color:#64748b;">Date: <strong>${sale.created_at ? sale.created_at.slice(0, 19) : '-'}</strong></div>
          <div style="margin-top:8px;font-size:14px;color:#64748b;">Payment: <strong>${sale.payment_method}</strong></div>
        </div>
      </div>

      <div class="invoice-detail-row">
        <div class="invoice-detail-set">
          <div>Customer</div>
          <strong>${sale.customer_name || 'Walk-in Customer'}</strong>
          <div>${sale.customer_phone || 'No phone provided'}</div>
        </div>
        <div class="invoice-detail-set">
          <div>Items</div>
          <strong>${sale.items?.length || sale.items_count || 0}</strong>
          <div>Invoice status: <span class="label-pill">Paid</span></div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;margin-top:18px;">
          <thead>
            <tr style="background:#f8fafc;color:#0f172a;text-align:left;">
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">#</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">Product</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">Qty</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">Price</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">Discount</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">GST</th>
              <th style="padding:12px 14px;border:1px solid #e2e8f0;">Line Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="invoice-totals">
        <div class="summary-card">
          <div>Subtotal</div>
          <strong>₹${formatCurrency(sale.subtotal)}</strong>
        </div>
        <div class="summary-card">
          <div>Discount</div>
          <strong>₹${formatCurrency(sale.discount)}</strong>
        </div>
        <div class="summary-card">
          <div>GST</div>
          <strong>₹${formatCurrency(sale.gst)}</strong>
        </div>
        <div class="summary-card">
          <div>Total Payable</div>
          <strong>₹${formatCurrency(sale.grand_total)}</strong>
        </div>
      </div>

      <div class="invoice-note">
        Thank you for shopping with Smart Inventory. Please keep this invoice for your records.
      </div>
    </div>
  `;
}

async function viewInvoice(id) {
  showLoading(true);
  try {
    const response = await fetch(`/api/sales/${id}`);
    if (!response.ok) throw new Error('Invoice not found');
    const sale = await response.json();
    renderInvoiceContent(sale);
    currentInvoiceId = id;
    const modal = document.getElementById('invoiceModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to load invoice.', 'error');
  } finally {
    showLoading(false);
  }
}

function printCurrentInvoice() {
  const modal = document.getElementById('invoiceModal');
  if (modal) {
    window.print();
  }
}

function bindFilters() {
  ['invoiceSearch', 'dateFilter', 'customerFilter', 'paymentFilter', 'minAmount', 'maxAmount', 'sortOrder'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', applySalesFilter);
      element.addEventListener('change', applySalesFilter);
    }
  });
}

function renderSummary(data) {
  const totalRevenue = data.reduce((sum, sale) => sum + Number(sale.grand_total || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const dailySales = data.filter((sale) => sale.created_at && sale.created_at.slice(0, 10) === today).length;
  const monthlySales = data.filter((sale) => sale.created_at && sale.created_at.slice(0, 7) === today.slice(0, 7)).length;
  const productCounts = data.reduce((acc, sale) => {
    (sale.items || []).forEach((item) => {
      acc[item.product_name] = (acc[item.product_name] || 0) + Number(item.quantity || 0);
    });
    return acc;
  }, {});
  const topEntry = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('totalRevenue').textContent = `₹${formatCurrency(totalRevenue)}`;
  document.getElementById('dailySales').textContent = dailySales;
  document.getElementById('monthlySales').textContent = monthlySales;
  document.getElementById('topSelling').textContent = topEntry ? `${topEntry[0]} (${topEntry[1]})` : '-';
}

function getFilteredSales() {
  const search = document.getElementById('invoiceSearch').value.toLowerCase();
  const dateFilter = document.getElementById('dateFilter').value;
  const customerFilter = document.getElementById('customerFilter').value.toLowerCase();
  const paymentFilter = document.getElementById('paymentFilter').value;
  const minAmount = Number(document.getElementById('minAmount').value || 0);
  const maxAmount = Number(document.getElementById('maxAmount').value || 0);
  const sortOrder = document.getElementById('sortOrder').value;

  return salesData
    .filter((sale) => {
      const invoiceMatch = `${sale.invoice_number}`.toLowerCase().includes(search);
      const customerMatch = `${sale.customer_name || ''}`.toLowerCase().includes(customerFilter);
      const paymentMatch = !paymentFilter || sale.payment_method === paymentFilter;
      const dateMatch = !dateFilter || (sale.created_at || '').slice(0, 10) === dateFilter;
      const amount = Number(sale.grand_total || 0);
      const minMatch = !minAmount || amount >= minAmount;
      const maxMatch = !maxAmount || amount <= maxAmount;
      return invoiceMatch && customerMatch && paymentMatch && dateMatch && minMatch && maxMatch;
    })
    .sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

function renderSales() {
  const filtered = getFilteredSales();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const pagedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tbody = document.getElementById('salesTableBody');
  if (!tbody) return;

  if (pagedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;">No invoices found for the selected filters.</td></tr>';
  } else {
    tbody.innerHTML = pagedData.map((sale) => `
      <tr>
        <td>${sale.invoice_number}</td>
        <td>${sale.created_at ? sale.created_at.slice(0, 19) : '-'}</td>
        <td>${sale.customer_name || 'Walk-in'}</td>
        <td>${sale.items_count || (sale.items?.length || 0)}</td>
        <td>₹${formatCurrency(sale.grand_total)}</td>
        <td>${sale.payment_method}</td>
        <td><span class="label-pill">${sale.status || 'Paid'}</span></td>
        <td class="table-actions">
          <button class="secondary" onclick="viewInvoice(${sale.id})">View</button>
          <button class="success" onclick="printInvoice(${sale.id})">Print</button>
          <button class="danger" onclick="deleteInvoice(${sale.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById('paginationControls');
  if (!container) return;
  container.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = currentPage <= 1;
  prevBtn.onclick = () => { currentPage -= 1; renderSales(); };
  container.appendChild(prevBtn);

  for (let page = 1; page <= totalPages; page += 1) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = page;
    pageBtn.className = page === currentPage ? 'active' : '';
    pageBtn.disabled = page === currentPage;
    pageBtn.onclick = () => { currentPage = page; renderSales(); };
    container.appendChild(pageBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => { currentPage += 1; renderSales(); };
  container.appendChild(nextBtn);
}

function applySalesFilter() {
  currentPage = 1;
  renderSales();
}

async function printInvoice(id) {
  showLoading(true);
  try {
    const response = await fetch(`/api/sales/${id}`);
    if (!response.ok) throw new Error('Invoice not found');
    const sale = await response.json();
    renderInvoiceContent(sale);
    currentInvoiceId = id;
    const modal = document.getElementById('invoiceModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
      requestAnimationFrame(() => window.print());
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to print invoice.', 'error');
  } finally {
    showLoading(false);
  }
}

async function downloadPdf(id) {
  if (!id) return;
  showLoading(true);
  try {
    const response = await fetch(`/api/sales/${id}/pdf`, { method: 'POST' });
    if (!response.ok) throw new Error('Unable to generate PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Invoice_${id}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to download invoice PDF.', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice and restore inventory?')) return;
  showLoading(true);
  try {
    const response = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Delete failed');
    showToast('Invoice deleted and stock restored.', 'success');
    closeInvoiceModal();
    await loadSales();
    window.localStorage.setItem('sales_updated_at', Date.now().toString());
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to delete invoice.', 'error');
  } finally {
    showLoading(false);
  }
}
