import { showToast } from '../main.js';

// Called by navigate() in main.js on every hash change and page load
export function initAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  const authPage = document.getElementById('auth-page');
  const appPage  = document.getElementById('app');

  if (token && userStr) {
    // ── LOGGED IN ──────────────────────────────────────
    authPage.style.display = 'none';
    appPage.style.display  = 'flex';

    // Patch sidebar with real user info
    try {
      const user = JSON.parse(userStr);
      const nameEl   = document.querySelector('.user-name');
      const roleEl   = document.querySelector('.user-role');
      const avatarEl = document.querySelector('.user-avatar');
      if (nameEl)   nameEl.textContent   = user.name;
      if (roleEl)   roleEl.textContent   = user.role;
      if (avatarEl) avatarEl.textContent = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    } catch (e) { /* ignore */ }

    return true; // authenticated
  } else {
    // ── NOT LOGGED IN ──────────────────────────────────
    authPage.style.display = 'flex';
    appPage.style.display  = 'none';
    _bindForms();
    return false; // not authenticated
  }
}

// ── Form binding (idempotent) ──────────────────────────────────
function _bindForms() {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (loginForm.dataset.bound) return;
  loginForm.dataset.bound = '1';

  // Toggle between login / register
  document.getElementById('show-register').addEventListener('click', e => {
    e.preventDefault();
    loginForm.style.display    = 'none';
    registerForm.style.display = 'block';
  });
  document.getElementById('show-login').addEventListener('click', e => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display    = 'block';
  });

  // ── LOGIN ──────────────────────────────────────────────────
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = loginForm.querySelector('button[type=submit]');
    btn.disabled    = true;
    btn.textContent = 'Signing in…';

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user',  JSON.stringify(data.user));
        showToast('Welcome back, ' + data.user.name + '!');
        _showApp();            // switch to the app WITHOUT reload
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch {
      showToast('Network error — is the server running?', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Sign In';
    }
  });

  // ── REGISTER ──────────────────────────────────────────────
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('req-name').value.trim();
    const email    = document.getElementById('req-email').value.trim();
    const password = document.getElementById('req-password').value;
    const role     = document.getElementById('req-role').value;

    const btn = registerForm.querySelector('button[type=submit]');
    btn.disabled    = true;
    btn.textContent = 'Creating…';

    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();

      if (res.ok) {
        // Auto-login after registration so they land on dashboard immediately
        const loginRes  = await fetch('/api/auth/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();

        if (loginRes.ok) {
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user',  JSON.stringify(loginData.user));
          showToast('Account created! Welcome, ' + loginData.user.name + '!');
          _showApp();
        } else {
          // Registration ok but auto-login failed — just switch to login tab
          showToast('Account created! Please sign in.', 'success');
          document.getElementById('show-login').click();
          registerForm.reset();
        }
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch {
      showToast('Network error — is the server running?', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Create Account';
    }
  });
}

// ── Switch the UI to the app and navigate to dashboard ──────────
function _showApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').style.display       = 'flex';
  initAuth();                        // patch sidebar user info
  window.location.hash = '#dashboard';  // triggers hashchange → navigate()
}

// ── Logout ──────────────────────────────────────────────────────
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.getElementById('app').style.display       = 'none';
  document.getElementById('auth-page').style.display = 'flex';
  // Reset forms so next user starts fresh
  ['login-form', 'register-form'].forEach(id => {
    const f = document.getElementById(id);
    if (f) { f.reset(); delete f.dataset.bound; }
  });
  document.getElementById('login-form').style.display    = 'block';
  document.getElementById('register-form').style.display = 'none';
  _bindForms();
}
