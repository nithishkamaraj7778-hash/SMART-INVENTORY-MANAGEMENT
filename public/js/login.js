document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const errorMsg = document.getElementById('error');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const authHint = document.getElementById('authHint');
  const submitBtn = document.getElementById('loginBtn');
  const serviceStatus = document.getElementById('serviceStatus');
  const serviceStatusLabel = document.getElementById('serviceStatusLabel');
  const serviceDatabase = document.getElementById('serviceDatabase');
  const authTitle = document.getElementById('authTitle');
  const authDescription = document.getElementById('authDescription');
  const togglePassword = document.getElementById('togglePassword');
  let isSignupMode = false;

  const setMessage = (message, state = 'error') => {
    errorMsg.textContent = message;
    errorMsg.dataset.state = state;
  };

  const renderSubmitButton = () => {
    submitBtn.innerHTML = isSignupMode
      ? '<span>Create account</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>'
      : '<span>Sign in</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
  };

  const setAuthMode = (signup) => {
    isSignupMode = signup;
    confirmPasswordGroup.classList.toggle('hidden', !signup);
    confirmPasswordInput.required = signup;
    confirmPasswordInput.value = '';
    passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
    renderSubmitButton();
    authTitle.textContent = signup ? 'Create your account' : 'Welcome back';
    authDescription.textContent = signup
      ? 'Set up an account to access your inventory workspace.'
      : 'Sign in to continue to your inventory dashboard.';
    authHint.textContent = signup ? 'Already have an account?' : 'New to Restock?';
    toggleAuthMode.textContent = signup ? 'Sign in' : 'Create an account';
    setMessage('');
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/health', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const health = await response.json();
      if (!response.ok || health.status !== 'ok') {
        throw new Error(`Health check returned HTTP ${response.status}`);
      }

      serviceStatus.dataset.state = 'online';
      serviceStatusLabel.textContent = 'Application services are online';
      serviceDatabase.textContent = `${String(health.database || 'Database').toUpperCase()} database connected`;
    } catch (error) {
      console.error('Application health check failed:', error);
      serviceStatus.dataset.state = 'offline';
      serviceStatusLabel.textContent = 'Application services unavailable';
      serviceDatabase.textContent = 'Unable to reach the server. Check your connection and retry.';
    }
  };

  const restoreSession = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) {
        window.location.replace('module-selection.html');
      } else if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('loggedIn');
      }
    } catch (error) {
      console.error('Unable to verify the existing session:', error);
    }
  };

  togglePassword.addEventListener('click', () => {
    const isPasswordHidden = passwordInput.type === 'password';
    passwordInput.type = isPasswordHidden ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', String(isPasswordHidden));
    togglePassword.setAttribute('aria-label', isPasswordHidden ? 'Hide password' : 'Show password');
    togglePassword.innerHTML = `<i class="fa-regular ${isPasswordHidden ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>`;
  });

  toggleAuthMode.addEventListener('click', (event) => {
    event.preventDefault();
    setAuthMode(!isSignupMode);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!username || !password) {
      setMessage('Please enter both your username and password.');
      return;
    }

    if (isSignupMode && password !== confirmPassword) {
      setMessage('Your passwords do not match.');
      return;
    }

    const submittingSignup = isSignupMode;
    setMessage('');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Connecting securely…</span><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>';

    try {
      if (submittingSignup) {
        const registrationResponse = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const registration = await registrationResponse.json();
        if (!registrationResponse.ok || !registration.success) {
          setMessage(registration.message || 'Unable to create your account.');
          return;
        }
      }

      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const login = await loginResponse.json();

      if (!loginResponse.ok || !login.success || !login.token) {
        const prefix = submittingSignup ? 'Your account was created, but sign-in failed. ' : '';
        setMessage(`${prefix}${login.message || 'Unable to sign in.'}`);
        if (submittingSignup) setAuthMode(false);
        return;
      }

      localStorage.setItem('authToken', login.token);
      localStorage.setItem('loggedIn', 'true');
      window.location.assign('module-selection.html');
    } catch (error) {
      console.error('Authentication request failed:', error);
      setMessage('Could not reach the authentication service. Please try again.');
    } finally {
      submitBtn.disabled = false;
      renderSubmitButton();
    }
  });

  setAuthMode(false);
  checkServiceStatus();
  window.setInterval(checkServiceStatus, 30000);
  restoreSession();
});
