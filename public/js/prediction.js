// ==========================================
// Smart Inventory Management - prediction.js
// ==========================================

let predictionItems = [];
let showingDemo = false;

const demoScenarios = [
  { name: 'Demo: Out of stock', quantity: 0, avg_daily_sales: 8, maximum: 120, minimum: 20 },
  { name: 'Demo: Critical demand', quantity: 12, avg_daily_sales: 6, maximum: 80, minimum: 15 },
  { name: 'Demo: Monitor stock', quantity: 72, avg_daily_sales: 6, maximum: 100, minimum: 20 },
  { name: 'Demo: Safe inventory', quantity: 240, avg_daily_sales: 5, maximum: 300, minimum: 25 }
];

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
    showingDemo = false;
    displayPredictions(predictionItems);
  } catch (err) {
    console.error('Predictions fetch error:', err);
    showToast('Failed to load restocking predictions. Check the server and retry.', 'error');
    document.getElementById('predictionTableBody').innerHTML = `
      <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">
        Unable to load live predictions. <button class="btn btn-primary" type="button" onclick="fetchPredictions()">Retry</button>
      </td></tr>`;
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
    const daysLeftText = typeof daysLeftVal === 'number' ? daysLeftVal.toFixed(1) + ' Days' : daysLeftVal || 'N/A';
    const avgDailySales = Number(item.avg_daily_sales) || 0;

    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${item.name}</td>
        <td>${item.quantity}</td>
        <td>${avgDailySales.toFixed(2)} / Day</td>
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

function showDemoScenarios() {
  showingDemo = true;
  const scenarios = demoScenarios.map((item, index) => {
    const daysLeft = item.avg_daily_sales ? item.quantity / item.avg_daily_sales : Infinity;
    const reorderLevel = Math.max(item.minimum, Math.ceil(item.avg_daily_sales * 7));
    const needsRestock = item.quantity <= reorderLevel;
    let priority = 'Safe';
    let priorityClass = 'safe';
    let recommendation = 'Stock Level Safe';

    if (item.quantity === 0) {
      priority = 'Out of Stock'; priorityClass = 'out'; recommendation = 'Immediate Restock Required';
    } else if (daysLeft <= 3) {
      priority = 'Critical'; priorityClass = 'critical'; recommendation = 'Immediate Restock; critical level';
    } else if (daysLeft <= 7) {
      priority = 'Low Stock'; priorityClass = 'low'; recommendation = 'Reorder soon; stock depleting';
    } else if (daysLeft <= 15) {
      priority = 'Monitor'; priorityClass = 'monitor'; recommendation = 'Monitor stock; regular replenishment';
    }

    return {
      ...item,
      id: `demo-${index + 1}`,
      days_left: Number.isFinite(daysLeft) ? Number(daysLeft.toFixed(2)) : 'N/A',
      suggested_quantity: needsRestock ? Math.max(0, item.maximum - item.quantity) : 0,
      priority, priorityClass, recommendation
    };
  });
  predictionItems = scenarios;
  displayPredictions(scenarios);
  showToast('Showing four prediction demo scenarios.', 'success');
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
