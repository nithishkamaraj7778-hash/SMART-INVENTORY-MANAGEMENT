// ==========================================
// Smart Inventory Management - inventory.js
// ==========================================

let inventoryItems = [];
let inventoryRefreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchInventory(true);
  inventoryRefreshTimer = setInterval(() => fetchInventory(false), 5000);
});

window.addEventListener('beforeunload', () => {
  if (inventoryRefreshTimer) {
    clearInterval(inventoryRefreshTimer);
  }
});

// Fetch products from API for the inventory list
async function fetchInventory(showLoader = true) {
  if (showLoader) {
    showLoading(true);
  }
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Inventory status: ' + response.status);
    inventoryItems = await response.json();
    displayInventory(inventoryItems);
  } catch (err) {
    console.error('Inventory fetch error:', err);
    if (showLoader) {
      showToast('Failed to load inventory ledger.', 'error');
    }
  } finally {
    if (showLoader) {
      showLoading(false);
    }
  }
}

// Display Inventory list in Table
function displayInventory(dataList) {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No inventory products recorded. Click "Products" page to register some.
        </td>
      </tr>
    `;
    return;
  }

  dataList.forEach((prod, index) => {
    let statusText = 'Available';
    let statusClass = 'available';
    let rowHighlightStyle = ''; // Auto-highlight low stock row background

    const quantity = parseInt(prod.quantity);
    const minimum = parseInt(prod.minimum);

    if (quantity === 0) {
      statusText = 'Out of Stock';
      statusClass = 'out';
      rowHighlightStyle = 'background-color: var(--color-danger-light);'; // Soft red highlight
    } else if (quantity <= minimum) {
      statusText = 'Low Stock';
      statusClass = 'low';
      rowHighlightStyle = 'background-color: var(--color-warning-light);'; // Soft yellow highlight
    }

    tbody.innerHTML += `
      <tr style="${rowHighlightStyle}">
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${prod.name}</td>
        <td>${prod.category}</td>
        <td>${prod.supplier}</td>
        <td style="font-weight: 500; color: var(--color-primary-dark);">₹${parseFloat(prod.price).toFixed(2)}</td>
        <td style="font-weight: 700;">${prod.quantity}</td>
        <td style="font-weight: 500;">${prod.minimum}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
      </tr>
    `;
  });
}

// Search and Filter logic
function filterInventory() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilter = document.getElementById('statusFilter').value;
  
  let filtered = inventoryItems;

  // Filter by stock status level
  if (statusFilter !== '') {
    filtered = filtered.filter(prod => {
      const qty = parseInt(prod.quantity);
      const min = parseInt(prod.minimum);
      
      if (statusFilter === 'out') return qty === 0;
      if (statusFilter === 'low') return qty <= min && qty > 0;
      if (statusFilter === 'available') return qty > min;
      return true;
    });
  }

  // Filter by search text
  if (query !== '') {
    filtered = filtered.filter(prod => 
      prod.name.toLowerCase().includes(query) || 
      prod.category.toLowerCase().includes(query) || 
      prod.supplier.toLowerCase().includes(query)
    );
  }

  displayInventory(filtered);
}
