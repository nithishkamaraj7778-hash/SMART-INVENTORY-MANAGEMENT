// ==========================================
// Smart Inventory Management - category.js
// ==========================================

let categories = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchCategories();
});

// Fetch all categories from API
async function fetchCategories() {
  showLoading(true);
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) {
      throw new Error('API server returned error: ' + response.status);
    }
    categories = await response.json();
    displayCategories(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    showToast('Failed to retrieve categories.', 'error');
  } finally {
    showLoading(false);
  }
}

// Display Category list in Table
function displayCategories(dataList) {
  const tbody = document.getElementById('categoryTableBody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No categories found. Click "Add Category" to create one.
        </td>
      </tr>
    `;
    return;
  }

  dataList.forEach((cat, index) => {
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 500; color: var(--text-primary);">${cat.name}</td>
        <td style="text-align: center;">
          <button class="action-btn edit" onclick="openEditModal(${cat.id}, '${escapeHtml(cat.name)}')" title="Edit Category">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="action-btn delete" onclick="deleteCategory(${cat.id}, '${escapeHtml(cat.name)}')" title="Delete Category" style="margin-left: 8px;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

// Search and Filter categories in Table
function filterCategories() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  if (query === '') {
    displayCategories(categories);
  } else {
    const filtered = categories.filter(cat => cat.name.toLowerCase().includes(query));
    displayCategories(filtered);
  }
}

// Modal open add state
function openAddModal() {
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryName').value = '';
  document.getElementById('modalTitle').textContent = 'Add Category';
  document.getElementById('saveBtn').textContent = 'Save Category';
  document.getElementById('categoryModal').classList.add('active');
}

// Modal open edit state
function openEditModal(id, name) {
  document.getElementById('categoryId').value = id;
  document.getElementById('categoryName').value = name;
  document.getElementById('modalTitle').textContent = 'Edit Category';
  document.getElementById('saveBtn').textContent = 'Update Category';
  document.getElementById('categoryModal').classList.add('active');
}

// Modal close
function closeModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

// Save Category Form submission (create or update)
async function saveCategory(event) {
  event.preventDefault();
  
  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  
  if (!name) {
    showToast('Category name cannot be empty.', 'warning');
    return;
  }

  showLoading(true);
  try {
    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(id ? 'Category updated successfully!' : 'Category created successfully!', 'success');
      closeModal();
      await fetchCategories();
    } else {
      showToast(data.message || 'Operation failed.', 'error');
    }
  } catch (err) {
    console.error('Category save error:', err);
    showToast('Connection error. Category save failed.', 'error');
  } finally {
    showLoading(false);
  }
}

// Delete Category
async function deleteCategory(id, name) {
  if (!confirm(`Are you sure you want to delete the category "${name}"?\nWarning: This will remove the classification from matching products.`)) {
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`/api/categories/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Category deleted successfully!', 'success');
      await fetchCategories();
    } else {
      showToast(data.message || 'Failed to delete category.', 'error');
    }
  } catch (err) {
    console.error('Category delete connection error:', err);
    showToast('Failed to delete category due to connection error.', 'error');
  } finally {
    showLoading(false);
  }
}

// Simple Helper to prevent HTML injection in DOM strings
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
