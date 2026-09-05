// ==========================================
// Smart Inventory Management - login.js
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const toggle = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const errorMsg = document.getElementById('error');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const authHint = document.getElementById('authHint');
  const submitBtn = document.getElementById('loginBtn');
  let isSignupMode = false;

  const setAuthMode = (signup) => {
    isSignupMode = signup;
    confirmPasswordGroup.classList.toggle('hidden', !signup);
    confirmPasswordInput.required = signup;
    confirmPasswordInput.value = '';
    submitBtn.innerHTML = signup ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-right-to-bracket"></i> Login';
    authHint.textContent = signup ? 'Already registered?' : 'New here?';
    toggleAuthMode.textContent = signup ? 'Back to login' : 'Create account';
    errorMsg.textContent = '';
  };

  // Toggle password visibility
  if (toggle && passwordInput) {
    toggle.onclick = () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggle.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        toggle.classList.replace('fa-eye-slash', 'fa-eye');
      }
    };
  }

  if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthMode(!isSignupMode);
    });
  }

  // Handle Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
      
      if (!username || !password) {
        errorMsg.textContent = 'Please enter both username and password.';
        return;
      }

      if (isSignupMode && password !== confirmPassword) {
        errorMsg.textContent = 'Passwords do not match.';
        return;
      }
      
      errorMsg.textContent = '';
      
      try {
        const endpoint = isSignupMode ? '/api/register' : '/api/login';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          localStorage.setItem('loggedIn', 'true');
          window.location.href = 'module-selection.html';
        } else {
          errorMsg.textContent = data.message || (isSignupMode ? 'Unable to create account.' : 'Invalid Username or Password');
        }
      } catch (err) {
        console.error('Authentication communication failure:', err);
        errorMsg.textContent = 'Server connection error. Make sure the API server is active.';
      }
    });
  }

  setAuthMode(false);
});
