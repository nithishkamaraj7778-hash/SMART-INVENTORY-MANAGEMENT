// ==========================================
// Smart Inventory Management - Global app.js
// ==========================================

// 1. Session Protection Check (except on login page)
if (!window.location.pathname.includes('login.html')) {
  if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'login.html';
  }
}

// 2. Real-Time DateTime Widget
document.addEventListener('DOMContentLoaded', () => {
  const dateTimeEl = document.getElementById('currentDateTime');
  if (dateTimeEl) {
    updateClock();
    setInterval(updateClock, 1000);
  }
});

function updateClock() {
  const dateTimeEl = document.getElementById('currentDateTime');
  if (!dateTimeEl) return;
  
  const now = new Date();
  
  // Format options: "Wednesday, July 1, 2026, 12:00:00 PM"
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  
  dateTimeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleString('en-US', options)}`;
}

// 3. Floating Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';
  if (type === 'warning') iconClass = 'fa-solid fa-circle-exclamation';
  if (type === 'info') iconClass = 'fa-solid fa-circle-info';

  toast.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-destroy after animation finishes (5 seconds total in CSS)
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// 4. Loading Overlay Controls
function showLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// 5. Open app pages in a new tab
function openAppPage(pagePath) {
  if (!pagePath) return;
  window.open(pagePath, '_blank', 'noopener,noreferrer');
}

// 6. User Sign Out
function logout() {
  localStorage.removeItem('loggedIn');
  window.location.href = 'login.html';
}
