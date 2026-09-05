// ==========================================
// Smart Inventory Management - prediction.js
// ==========================================

let predictionItems = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchPredictions();
});

// Fetch forecast results from the API
async function fetchPredictions() {
  showLoading(true);
  try {
    const response = await fetch('/api/prediction');
    if (!response.ok) throw new Error('Prediction API returned status: ' + response.status);
    predictionItems = await response.json();
    displayPredictions(predictionItems);
  } catch (err) {
    console.error('Predictions fetch error:', err);
    showToast('Failed to load restocking predictions.', 'error');
  } finally {
    showLoading(false);
  }
}

// Display Predictions list in Table
function displayPredictions(dataList) {
  const tbody = document.getElementById('predictionTableBody');
  tbody.innerHTML = '';

  if (dataList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">
          No predictions available. Add products to check predictions.
        </td>
      </tr>
    `;
    return;
  }

  dataList.forEach((item, index) => {
    // Determine priority highlight color for suggested quantity
    const qtyStyle = item.suggested_quantity > 0 ? 'font-weight: 700; color: var(--color-warning);' : 'color: var(--text-secondary);';
    
    // Format Days Left
    const daysLeftVal = item.days_left;
    const daysLeftText = typeof daysLeftVal === 'number' ? daysLeftVal.toFixed(1) + ' Days' : daysLeftVal;

    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.avg_daily_sales.toFixed(2)} / Day</td>
        <td style="font-weight: 600; color: var(--color-primary-dark);">${daysLeftText}</td>
        <td style="${qtyStyle}">${item.suggested_quantity} units</td>
        <td>
          <span class="status-badge ${item.priorityClass}">${item.priority}</span>
        </td>
        <td style="font-weight: 500; font-size: 13px;">${item.recommendation}</td>
      </tr>
    `;
  });
}

// Search and Filter logic
function filterPredictions() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const priorityFilter = document.getElementById('priorityFilter').value.toLowerCase();
  
  let filtered = predictionItems;

  // Filter by priority
  if (priorityFilter !== '') {
    filtered = filtered.filter(item => item.priority.toLowerCase() === priorityFilter);
  }

  // Filter by search query
  if (query !== '') {
    filtered = filtered.filter(item => item.name.toLowerCase().includes(query));
  }

  displayPredictions(filtered);
}
