// ==========================================
// Smart Inventory Management - product.js
// ==========================================

let products = [];
let categories = [];
let suppliers = [];

document.addEventListener('DOMContentLoaded', () => {
  initializeProductPage();
});

async function initializeProductPage() {
  showLoading(true);
  try {
    await Promise.all([
      fetchCategories(),
      fetchSuppliers(),
      fetchProducts()
    ]);
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Failed to load page data dependencies.', 'error');
  } finally {
    showLoading(false);
  }
}

// Fetch all products
async function fetchProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Products status: ' + response.status);
    products = await response.json();
    displayProducts(products);
  } catch (err) {
    console.error('Products fetch error:', err);
    showToast('Failed to load products list.', 'error');
  }
}

// Fetch categories and populate dropdowns
async function fetchCategories() {
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('Categories status: ' + response.status);
    categories = await response.json();
    
    // 1. Populate search filter dropdown
    const filterSelect = document.getElementById('categoryFilter');
    filterSelect.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      filterSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
    });

    // 2. Populate form modal dropdown
    const formSelect = document.getElementById('productCategory');
    formSelect.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
      formSelect.innerHTML += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
    });
  } catch (err) {
    console.error('Categories fetch error:', err);
  }
}

// Fetch suppliers and populate form dropdown
async function fetchSuppliers() {
  try {
    const response = await fetch('/api/suppliers');
    if (!response.ok) throw new Error('Suppliers status: ' + response.status);
    suppliers = await response.json();
    
    const formSelect = document.getElementById('productSupplier');
    formSelect.innerHTML = '<option value="">Select Supplier</option>';
    suppliers.forEach(sup => {
      formSelect.innerHTML += `<option value="${escapeHtml(sup.name)}">${escapeHtml(sup.name)} (${escapeHtml(sup.company)})</option>`;
    });
  } catch (err) {
    console.error('Suppliers fetch error:', err);
  }
}

// Display product list in Table
function displayProducts(dataList) {
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No products found. Click "Add Product" to create one.
        </td>
      </tr>
    `;
    return;
  }

  dataList.forEach((prod, index) => {
    let statusText = 'Available';
    let statusClass = 'available';
    
    const quantity = parseInt(prod.quantity);
    const minimum = parseInt(prod.minimum);

    if (quantity === 0) {
      statusText = 'Out of Stock';
      statusClass = 'out';
    } else if (quantity <= minimum) {
      statusText = 'Low Stock';
      statusClass = 'low';
    }

    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${prod.name}</td>
        <td>${prod.category}</td>
        <td>${prod.supplier}</td>
        <td style="font-weight: 500; color: var(--color-primary-dark);">₹${parseFloat(prod.price).toFixed(2)}</td>
        <td style="font-weight: 600;">${prod.quantity}</td>
        <td>${prod.minimum}</td>
        <td>${parseFloat(prod.avg_daily_sales).toFixed(2)}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td style="text-align: center;">
          <button class="action-btn edit" onclick="openEditModal(${prod.id})" title="Edit Product">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="action-btn delete" onclick="deleteProduct(${prod.id}, '${escapeHtml(prod.name)}')" title="Delete Product" style="margin-left: 6px;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

// Search and Filter logic
function filterProducts() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const categoryFilter = document.getElementById('categoryFilter').value;
  
  let filtered = products;

  // Filter by Category dropdown
  if (categoryFilter !== '') {
    filtered = filtered.filter(prod => prod.category === categoryFilter);
  }

  // Filter by Search text
  if (query !== '') {
    filtered = filtered.filter(prod => 
      prod.name.toLowerCase().includes(query) || 
      prod.category.toLowerCase().includes(query) || 
      prod.supplier.toLowerCase().includes(query)
    );
  }

  displayProducts(filtered);
}

// Open modal for Adding
function openAddModal() {
  if (categories.length === 0) {
    showToast('Please add at least one classification category first!', 'warning');
    return;
  }
  if (suppliers.length === 0) {
    showToast('Please register at least one wholesale supplier first!', 'warning');
    return;
  }

  document.getElementById('productId').value = '';
  document.getElementById('productForm').reset();
  document.getElementById('modalTitle').textContent = 'Add Product';
  document.getElementById('saveBtn').textContent = 'Save Product';
  document.getElementById('productModal').classList.add('active');
}

// Open modal for Editing
function openEditModal(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('productId').value = prod.id;
  document.getElementById('productName').value = prod.name;
  document.getElementById('productCategory').value = prod.category;
  document.getElementById('productSupplier').value = prod.supplier;
  document.getElementById('productPrice').value = prod.price;
  document.getElementById('productGst').value = prod.gst || 0;
  document.getElementById('productQuantity').value = prod.quantity;
  document.getElementById('productMinimum').value = prod.minimum;
  document.getElementById('productMaximum').value = prod.maximum || (prod.minimum * 2);
  document.getElementById('productAvgSales').value = prod.avg_daily_sales;

  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('saveBtn').textContent = 'Update Product';
  document.getElementById('productModal').classList.add('active');
}

// Close Modal
function closeModal() {
  document.getElementById('productModal').classList.remove('active');
}

// Save Product (create / update)
async function saveProduct(event) {
  event.preventDefault();

  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const category = document.getElementById('productCategory').value;
  const supplier = document.getElementById('productSupplier').value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const quantity = parseInt(document.getElementById('productQuantity').value);
  const minimum = parseInt(document.getElementById('productMinimum').value);
  const maximum = parseInt(document.getElementById('productMaximum').value);
  const avg_daily_sales = parseFloat(document.getElementById('productAvgSales').value);
  const gst = parseFloat(document.getElementById('productGst').value) || 0;

  // Validate form fields
  if (!name || !category || !supplier || isNaN(price) || isNaN(quantity) || isNaN(minimum) || isNaN(maximum) || isNaN(avg_daily_sales)) {
    showToast('Please fill all fields with valid data.', 'warning');
    return;
  }

  if (quantity > maximum) {
    showToast('Current Quantity cannot exceed Maximum Stock capacity.', 'warning');
    return;
  }

  showLoading(true);
  try {
    const payload = { name, category, supplier, price, gst, quantity, minimum, maximum, avg_daily_sales };
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      showToast(id ? 'Product updated successfully!' : 'Product added successfully!', 'success');
      closeModal();
      await fetchProducts();
    } else {
      showToast(data.message || 'Operation failed.', 'error');
    }
  } catch (err) {
    console.error('Product save error:', err);
    showToast('Connection error. Product save failed.', 'error');
  } finally {
    showLoading(false);
  }
}

// Delete Product
async function deleteProduct(id, name) {
  if (!confirm(`Are you sure you want to delete the product "${name}"?\nThis action cannot be undone.`)) {
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    
    if (response.ok) {
      showToast('Product deleted successfully!', 'success');
      await fetchProducts();
    } else {
      showToast(data.message || 'Failed to delete product.', 'error');
    }
  } catch (err) {
    console.error('Product delete communication error:', err);
    showToast('Connection error. Failed to delete product.', 'error');
  } finally {
    showLoading(false);
  }
}

// Simple Helper to prevent HTML injection in DOM strings
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
