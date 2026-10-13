// ==========================================
// Smart Inventory Management - dashboard.js
// ==========================================

let stockBarChart = null;
let categoryPieChart = null;

document.addEventListener('DOMContentLoaded', () => {
  attachCardNavigation();
  loadDashboardTelemetry();
});

function attachCardNavigation() {
  document.querySelectorAll('.stat-card').forEach((card) => {
    const targetPage = card.getAttribute('data-page');

    if (!targetPage) return;

    const navigate = () => {
      openAppPage(targetPage);
    };

    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate();
      }
    });
  });
}

async function loadDashboardTelemetry() {
  showLoading(true);
  try {
    const response = await fetch('/api/dashboard/stats');
    if (!response.ok) {
      throw new Error('API server returned status: ' + response.status);
    }
    const data = await response.json();
    
    // 1. Update Card Summaries
    document.getElementById('totalProducts').textContent = data.summary.totalProducts;
    document.getElementById('totalCategories').textContent = data.summary.totalCategories;
    document.getElementById('totalSuppliers').textContent = data.summary.totalSuppliers;
    document.getElementById('totalLowStock').textContent = data.summary.lowStockCount;
    document.getElementById('todaySalesCount').textContent = data.salesStats.todaySalesCount;
    document.getElementById('todayRevenue').textContent = `₹${Number(data.salesStats.todayRevenue || 0).toFixed(2)}`;
    document.getElementById('productsSoldToday').textContent = data.salesStats.productsSoldToday;

    // 2. Populate Low Stock Alerts Table
    populateLowStockTable(data.lowStockAlerts);

    // 3. Render System Notifications Log
    populateNotificationsLog(data.notifications);

    // 4. Initialize Visual Charts
    renderCharts(data.charts);

    // 5. Populate latest bills widget
    populateLatestBills(data.latestBills);

  } catch (err) {
    console.error('Error fetching dashboard telemetry:', err);
    showToast('Failed to load dashboard data. Check database connections.', 'error');
  } finally {
    showLoading(false);
  }
}

window.addEventListener('storage', (event) => {
  if (event.key === 'sales_updated_at') {
    loadDashboardTelemetry();
    showToast('Dashboard refreshed after sales update.', 'info');
  }
});

function populateLowStockTable(alerts) {
  const tbody = document.getElementById('stockTable');
  tbody.innerHTML = '';

  if (!alerts || alerts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">
          <i class="fa-solid fa-square-check" style="color: var(--color-success); font-size: 20px; margin-bottom: 8px; display: block;"></i>
          All stock levels are above safety thresholds!
        </td>
      </tr>
    `;
    return;
  }

  alerts.forEach(prod => {
    const statusText = prod.quantity === 0 ? 'Out of Stock' : 'Low Stock';
    const statusClass = prod.quantity === 0 ? 'out' : 'low';
    
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${prod.name}</td>
        <td>${prod.quantity}</td>
        <td>${prod.minimum}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
      </tr>
    `;
  });
}

function populateLatestBills(bills) {
  const tbody = document.getElementById('latestBillsTable');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!bills || bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No bills recorded yet.</td></tr>';
    return;
  }

  bills.forEach((bill) => {
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${bill.invoice_number}</td>
        <td>${bill.customer_name || 'Walk-in'}</td>
        <td>₹${Number(bill.grand_total || 0).toFixed(2)}</td>
        <td>${bill.created_at ? bill.created_at.slice(0, 19) : '-'}</td>
      </tr>
    `;
  });
}

function populateNotificationsLog(notifications) {
  const container = document.getElementById('notificationsLog');
  container.innerHTML = '';

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div class="notification-item info" style="background-color: var(--color-success-light); border-left-color: var(--color-success);">
        <i class="fa-solid fa-circle-check notification-item-icon" style="color: var(--color-success);"></i>
        <div>System status stable. No replenishment actions required today.</div>
      </div>
    `;
    return;
  }

  notifications.forEach(note => {
    let iconClass = 'fa-solid fa-circle-info';
    if (note.type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';
    if (note.type === 'danger') iconClass = 'fa-solid fa-circle-xmark';

    container.innerHTML += `
      <div class="notification-item ${note.type}">
        <i class="${iconClass} notification-item-icon"></i>
        <div>${note.message}</div>
      </div>
    `;
  });
}

function renderCharts(chartData) {
  Chart.defaults.color = '#a7b4c7';
  Chart.defaults.borderColor = 'rgba(180, 198, 224, 0.12)';

  // --- A. Product Stock Levels (Bar Chart) ---
  const barCanvas = document.getElementById('stockBarChart');
  if (barCanvas) {
    const productNames = chartData.productStocks.map(p => p.name);
    const productQuantities = chartData.productStocks.map(p => p.quantity);
    const productMinimums = chartData.productStocks.map(p => p.minimum);

    if (stockBarChart) stockBarChart.destroy();
    
    stockBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: productNames,
        datasets: [
          {
            label: 'Current Stock',
            data: productQuantities,
            backgroundColor: 'rgba(37, 99, 235, 0.75)', // primary blue
            borderColor: 'rgb(37, 99, 235)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Minimum Safety Stock',
            data: productMinimums,
            backgroundColor: 'rgba(239, 68, 68, 0.4)', // transparent red
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { family: 'Inter' } }
          },
          x: {
            ticks: { font: { family: 'Inter' } }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Inter', weight: '500' } }
          }
        }
      }
    });
  }

  // --- B. Category Distribution (Pie Chart) ---
  const pieCanvas = document.getElementById('categoryPieChart');
  if (pieCanvas) {
    const categories = chartData.categoryDistribution.map(c => c.category);
    const counts = chartData.categoryDistribution.map(c => c.count);

    if (categoryPieChart) categoryPieChart.destroy();
    
    categoryPieChart = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: counts,
          backgroundColor: [
            'rgba(37, 99, 235, 0.75)',   // Royal Blue
            'rgba(6, 182, 212, 0.75)',   // Cyan
            'rgba(16, 185, 129, 0.75)',  // Emerald Green
            'rgba(245, 158, 11, 0.75)',  // Amber Orange
            'rgba(139, 92, 246, 0.75)',  // Violet Purple
            'rgba(239, 68, 68, 0.75)'    // Red
          ],
          borderWidth: 2,
          borderColor: '#101a2b'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { family: 'Inter', weight: '500' } }
          }
        }
      }
    });
  }
}
