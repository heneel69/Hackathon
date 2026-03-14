import { showToast } from '../main.js';

// In-memory state for the reset flow
let _resetEmail = '';
let _otpTimerInterval = null;

// All form IDs managed by this module
const ALL_FORMS = ['login-form', 'register-form', 'forgot-form', 'otp-form', 'reset-form'];

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

// ── Helper: show exactly one form ─────────────────────────────
function _showForm(id) {
  ALL_FORMS.forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.style.display = fid === id ? 'block' : 'none';
  });
}

// ── Form binding (idempotent) ──────────────────────────────────
function _bindForms() {
  const loginForm = document.getElementById('login-form');
  if (loginForm.dataset.bound) return;
  loginForm.dataset.bound = '1';

  // ── Toggles ─────────────────────────────────────────────────
  document.getElementById('show-register').addEventListener('click', e => {
    e.preventDefault();
    _showForm('register-form');
  });
  document.getElementById('show-login').addEventListener('click', e => {
    e.preventDefault();
    _showForm('login-form');
  });
  document.getElementById('show-forgot').addEventListener('click', e => {
    e.preventDefault();
    _showForm('forgot-form');
  });
  document.getElementById('show-login-from-forgot').addEventListener('click', e => {
    e.preventDefault();
    _showForm('login-form');
  });
  document.getElementById('show-login-from-otp').addEventListener('click', e => {
    e.preventDefault();
    _stopOtpTimer();
    _showForm('login-form');
  });
  document.getElementById('show-login-from-reset').addEventListener('click', e => {
    e.preventDefault();
    _showForm('login-form');
  });

  // ── LOGIN ────────────────────────────────────────────────────
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
        _showApp();
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

  // ── REGISTER ─────────────────────────────────────────────────
  const registerForm = document.getElementById('register-form');
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
          showToast('Account created! Please sign in.', 'success');
          _showForm('login-form');
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

  // ── FORGOT PASSWORD ──────────────────────────────────────────
  const forgotForm = document.getElementById('forgot-form');
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn   = document.getElementById('btn-send-otp');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        _resetEmail = email;
        showToast('OTP sent! Check the server console for demo.', 'success');
        _showForm('otp-form');
        _startOtpTimer(10 * 60); // 10 minute countdown
        document.getElementById('otp-input').value = '';
        document.getElementById('otp-input').focus();
      } else {
        showToast(data.error || 'Failed to send OTP', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Send OTP';
    }
  });

  // Resend OTP
  document.getElementById('resend-otp').addEventListener('click', async e => {
    e.preventDefault();
    if (!_resetEmail) { _showForm('forgot-form'); return; }
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: _resetEmail }),
      });
      if (res.ok) {
        showToast('New OTP sent! Check the server console.', 'success');
        _startOtpTimer(10 * 60);
        document.getElementById('otp-input').value = '';
        document.getElementById('otp-input').focus();
      }
    } catch { showToast('Network error', 'error'); }
  });

  // ── VERIFY OTP ───────────────────────────────────────────────
  const otpForm = document.getElementById('otp-form');
  otpForm.addEventListener('submit', async e => {
    e.preventDefault();
    const otp = document.getElementById('otp-input').value.trim();
    const btn = document.getElementById('btn-verify-otp');
    btn.disabled    = true;
    btn.textContent = 'Verifying…';

    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: _resetEmail, otp }),
      });
      const data = await res.json();

      if (res.ok) {
        _stopOtpTimer();
        showToast('OTP verified! Set your new password.', 'success');
        _showForm('reset-form');
        document.getElementById('reset-password').value = '';
        document.getElementById('reset-password-confirm').value = '';
        document.getElementById('reset-password').focus();
      } else {
        showToast(data.error || 'Invalid or expired OTP', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Verify Code';
    }
  });

  // ── RESET PASSWORD ───────────────────────────────────────────
  const resetPwdInput   = document.getElementById('reset-password');
  const resetConfInput  = document.getElementById('reset-password-confirm');
  const resetSubmitBtn  = document.getElementById('btn-reset-submit');
  const strengthBar     = document.getElementById('pwd-strength-bar');
  const strengthLabel   = document.getElementById('pwd-strength-label');
  const matchMsg        = document.getElementById('pwd-match-msg');

  function _checkResetForm() {
    const pwd     = resetPwdInput.value;
    const confirm = resetConfInput.value;

    // Strength meter
    const score = _passwordStrength(pwd);
    const levels = [
      { label: '', width: '0%', color: 'transparent' },
      { label: 'Weak',      width: '25%', color: '#ef4444' },
      { label: 'Fair',      width: '50%', color: '#f97316' },
      { label: 'Good',      width: '75%', color: '#eab308' },
      { label: 'Strong',    width: '100%', color: '#22c55e' },
    ];
    const level = levels[score];
    strengthBar.style.width      = level.width;
    strengthBar.style.background = level.color;
    strengthLabel.textContent    = pwd.length > 0 ? level.label : '';

    // Match check
    const matches = pwd === confirm && confirm.length > 0;
    if (confirm.length > 0) {
      matchMsg.style.display = 'block';
      matchMsg.textContent   = matches ? '✓ Passwords match' : '✗ Passwords do not match';
      matchMsg.style.color   = matches ? '#22c55e' : '#ef4444';
    } else {
      matchMsg.style.display = 'none';
    }

    resetSubmitBtn.disabled = !(matches && pwd.length >= 8);
  }

  resetPwdInput.addEventListener('input', _checkResetForm);
  resetConfInput.addEventListener('input', _checkResetForm);

  const resetForm = document.getElementById('reset-form');
  resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword = resetPwdInput.value;
    resetSubmitBtn.disabled    = true;
    resetSubmitBtn.textContent = 'Resetting…';

    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: _resetEmail, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast('Password reset successfully! Please sign in.', 'success');
        _resetEmail = '';
        _showForm('login-form');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
      } else {
        showToast(data.error || 'Reset failed', 'error');
        resetSubmitBtn.disabled = false;
      }
    } catch {
      showToast('Network error', 'error');
      resetSubmitBtn.disabled = false;
    } finally {
      resetSubmitBtn.textContent = 'Reset Password';
    }
  });
}

// ── Password strength scorer (0-4) ────────────────────────────
function _passwordStrength(pwd) {
  if (!pwd || pwd.length < 4) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

// ── OTP Countdown timer ───────────────────────────────────────
function _startOtpTimer(seconds) {
  _stopOtpTimer();
  const countdownEl = document.getElementById('otp-countdown');
  let remaining = seconds;

  function tick() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    if (countdownEl) countdownEl.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      _stopOtpTimer();
      if (countdownEl) countdownEl.textContent = 'Expired';
      showToast('OTP expired. Please request a new one.', 'error');
    }
    remaining--;
  }
  tick();
  _otpTimerInterval = setInterval(tick, 1000);
}

function _stopOtpTimer() {
  if (_otpTimerInterval) {
    clearInterval(_otpTimerInterval);
    _otpTimerInterval = null;
  }
}

// ── Switch the UI to the app and navigate to dashboard ─────────
function _showApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').style.display       = 'flex';
  initAuth();                           // patch sidebar user info
  window.location.hash = '#dashboard'; // triggers hashchange → navigate()
}

// ── Logout ─────────────────────────────────────────────────────
export function logout() {
  _stopOtpTimer();
  _resetEmail = '';
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.getElementById('app').style.display       = 'none';
  document.getElementById('auth-page').style.display = 'flex';

  // Reset ALL forms so next user starts fresh
  ALL_FORMS.forEach(id => {
    const f = document.getElementById(id);
    if (f) { f.reset(); delete f.dataset.bound; }
  });

  // Only show login form
  _showForm('login-form');
  _bindForms();
}
