// ==========================================
// Smart Inventory Management - Global app.js
// ==========================================

// 1. Attach the server session to API calls and guard protected pages.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem('authToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return originalFetch(input, { ...init, headers }).then((response) => {
    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('loggedIn');
      window.location.href = 'login.html';
    }
    return response;
  });
};

if (!window.location.pathname.includes('login.html') && !localStorage.getItem('authToken')) {
  window.location.href = 'login.html';
}

// 2. Real-Time DateTime Widget & Mobile Sidebar
document.addEventListener('DOMContentLoaded', () => {
  const dateTimeEl = document.getElementById('currentDateTime');
  if (dateTimeEl) {
    updateClock();
    setInterval(updateClock, 1000);
  }

  initMobileSidebar();
});

/** Inject hamburger toggle and overlay for small-screen navigation */
function initMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const menuBtn = document.createElement('button');
  menuBtn.className = 'mobile-menu-btn';
  menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
  menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';

  document.body.appendChild(menuBtn);
  document.body.appendChild(overlay);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', closeSidebar);

  sidebar.querySelectorAll('.sidebar-menu li, .sidebar-footer li').forEach((item) => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

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
  
  dateTimeEl.textContent = now.toLocaleString('en-US', options);
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

  const icon = document.createElement('i');
  icon.className = `${iconClass} toast-icon`;
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);

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

// 5. Keep navigation in the current application tab.
function openAppPage(pagePath) {
  if (!pagePath) return;
  window.location.href = pagePath;
}

// 6. User Sign Out
function logout() {
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('authToken');
  localStorage.removeItem('loggedIn');
  window.location.href = 'login.html';
}
