/* ─── auth.js — Login & Signup frontend logic ───────────────── */
const API = '/api/auth';

function showAlert(el, msg, type = 'error') {
    el.textContent = msg;
    el.className = `alert ${type} show`;
}
function hideAlert(el) {
    el.className = 'alert';
}
function setLoading(btn, loading, defaultText) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : defaultText;
}

/* ── LOGIN PAGE ────────────────────────────────────────────── */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    // If user is already logged in, redirect to dashboard
    if (localStorage.getItem('ims_token')) {
        window.location.replace('/dashboard');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('alert');
        const btn = document.getElementById('loginBtn');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            return showAlert(alert, 'Please fill in all fields.');
        }
        hideAlert(alert);
        setLoading(btn, true, 'Sign In');

        try {
            const res = await fetch(`${API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(alert, data.error || 'Login failed.');
            } else {
                localStorage.setItem('ims_token', data.token);
                localStorage.setItem('ims_user', JSON.stringify(data.user));
                window.location.href = '/dashboard';
            }
        } catch {
            showAlert(alert, 'Network error. Is the server running?');
        } finally {
            setLoading(btn, false, 'Sign In');
        }
    });
}

/* ── SIGNUP PAGE ───────────────────────────────────────────── */
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('alert');
        const btn = document.getElementById('signupBtn');
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const role = document.getElementById('role').value;
        const password = document.getElementById('password').value;

        if (!name || !email || !password) {
            return showAlert(alert, 'Please fill in all required fields.');
        }
        if (password.length < 8) {
            return showAlert(alert, 'Password must be at least 8 characters.');
        }
        hideAlert(alert);
        setLoading(btn, true, 'Create Account');

        try {
            const res = await fetch(`${API}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(alert, data.error || 'Registration failed.');
            } else {
                showAlert(alert, '✅ Account created! Redirecting to login…', 'success');
                setTimeout(() => { window.location.href = '/'; }, 1500);
            }
        } catch {
            showAlert(alert, 'Network error. Is the server running?');
        } finally {
            setLoading(btn, false, 'Create Account');
        }
    });
}
