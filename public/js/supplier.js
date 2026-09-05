// ==========================================
// Smart Inventory Management - supplier.js
// ==========================================

let suppliers = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchSuppliers();
});

// Fetch all suppliers
async function fetchSuppliers() {
  showLoading(true);
  try {
    const response = await fetch('/api/suppliers');
    if (!response.ok) throw new Error('Suppliers status: ' + response.status);
    suppliers = await response.json();
    displaySuppliers(suppliers);
  } catch (err) {
    console.error('Suppliers fetch error:', err);
    showToast('Failed to load suppliers registry.', 'error');
  } finally {
    showLoading(false);
  }
}

// Display Suppliers list in Table
function displaySuppliers(dataList) {
  const tbody = document.getElementById('supplierTableBody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No suppliers registered. Click "Add Supplier" to create one.
        </td>
      </tr>
    `;
    return;
  }

  dataList.forEach((sup, index) => {
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${sup.name}</td>
        <td>${sup.company}</td>
        <td>${sup.phone}</td>
        <td><a href="mailto:${sup.email}" style="color: var(--color-primary); text-decoration: none;">${sup.email}</a></td>
        <td>${sup.address}</td>
        <td style="text-align: center;">
          <button class="action-btn edit" onclick="openEditModal(${sup.id})" title="Edit Supplier">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="action-btn delete" onclick="deleteSupplier(${sup.id}, '${escapeHtml(sup.name)}')" title="Delete Supplier" style="margin-left: 6px;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

// Search and Filter suppliers in Table
function filterSuppliers() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  if (query === '') {
    displaySuppliers(suppliers);
  } else {
    const filtered = suppliers.filter(sup => 
      sup.name.toLowerCase().includes(query) || 
      sup.company.toLowerCase().includes(query) || 
      sup.email.toLowerCase().includes(query) ||
      sup.phone.includes(query)
    );
    displaySuppliers(filtered);
  }
}

// Open modal for Adding
function openAddModal() {
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierForm').reset();
  document.getElementById('modalTitle').textContent = 'Add Supplier';
  document.getElementById('saveBtn').textContent = 'Save Supplier';
  document.getElementById('supplierModal').classList.add('active');
}

// Open modal for Editing
function openEditModal(id) {
  const sup = suppliers.find(s => s.id === id);
  if (!sup) return;

  document.getElementById('supplierId').value = sup.id;
  document.getElementById('supplierName').value = sup.name;
  document.getElementById('supplierCompany').value = sup.company;
  document.getElementById('supplierPhone').value = sup.phone;
  document.getElementById('supplierEmail').value = sup.email;
  document.getElementById('supplierAddress').value = sup.address;

  document.getElementById('modalTitle').textContent = 'Edit Supplier';
  document.getElementById('saveBtn').textContent = 'Update Supplier';
  document.getElementById('supplierModal').classList.add('active');
}

// Close Modal
function closeModal() {
  document.getElementById('supplierModal').classList.remove('active');
}

// Save Supplier Form submission
async function saveSupplier(event) {
  event.preventDefault();

  const id = document.getElementById('supplierId').value;
  const name = document.getElementById('supplierName').value.trim();
  const company = document.getElementById('supplierCompany').value.trim();
  const phone = document.getElementById('supplierPhone').value.trim();
  const email = document.getElementById('supplierEmail').value.trim();
  const address = document.getElementById('supplierAddress').value.trim();

  // Validate fields
  if (!name || !company || !phone || !email || !address) {
    showToast('Please fill all supplier details.', 'warning');
    return;
  }

  showLoading(true);
  try {
    const payload = { name, company, phone, email, address };
    const url = id ? `/api/suppliers/${id}` : '/api/suppliers';
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
      showToast(id ? 'Supplier updated successfully!' : 'Supplier added successfully!', 'success');
      closeModal();
      await fetchSuppliers();
    } else {
      showToast(data.message || 'Operation failed.', 'error');
    }
  } catch (err) {
    console.error('Supplier save error:', err);
    showToast('Connection error. Supplier save failed.', 'error');
  } finally {
    showLoading(false);
  }
}

// Delete Supplier
async function deleteSupplier(id, name) {
  if (!confirm(`Are you sure you want to delete the supplier "${name}"?\nWarning: This will clear classifications from matching products.`)) {
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`/api/suppliers/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    
    if (response.ok) {
      showToast('Supplier record deleted successfully!', 'success');
      await fetchSuppliers();
    } else {
      showToast(data.message || 'Failed to delete supplier.', 'error');
    }
  } catch (err) {
    console.error('Supplier delete error:', err);
    showToast('Failed to delete supplier due to connection error.', 'error');
  } finally {
    showLoading(false);
  }
}

// Helper to escape HTML characters
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
