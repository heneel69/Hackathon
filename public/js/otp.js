/* ─── otp.js — Forgot password / OTP / Reset flow ───────────── */
const API = '/api/auth';

function showAlert(el, msg, type = 'error') {
    el.textContent = msg;
    el.className = `alert ${type} show`;
}
function hideAlert(el) { el.className = 'alert'; }
function setLoading(btn, loading, defaultText) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : defaultText;
}

/* ─── Page 1: Forgot Password (forgot.html) ───────────────── */
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('alert');
        const btn = document.getElementById('forgotBtn');
        const email = document.getElementById('email').value.trim();
        if (!email) return showAlert(alert, 'Please enter your email address.');
        hideAlert(alert);
        setLoading(btn, true, 'Send OTP');

        try {
            const res = await fetch(`${API}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(alert, data.error || 'Request failed.');
            } else {
                // Store email for next page
                sessionStorage.setItem('otp_email', email);
                showAlert(alert, '✅ OTP sent! Check the server console. Redirecting…', 'success');
                setTimeout(() => { window.location.href = '/verify-otp'; }, 1800);
            }
        } catch {
            showAlert(alert, 'Network error. Is the server running?');
        } finally {
            setLoading(btn, false, 'Send OTP');
        }
    });
}

/* ─── Page 2: Verify OTP (verify-otp.html) ───────────────── */
const otpForm = document.getElementById('otpForm');
if (otpForm) {
    const email = sessionStorage.getItem('otp_email');
    if (!email) window.location.replace('/forgot');

    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('alert');
        const btn = document.getElementById('verifyBtn');
        const otp = document.getElementById('otp').value.trim();
        if (!otp) return showAlert(alert, 'Please enter the OTP.');
        hideAlert(alert);
        setLoading(btn, true, 'Verify OTP');

        try {
            const res = await fetch(`${API}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(alert, data.error || 'OTP verification failed.');
            } else {
                showAlert(alert, '✅ OTP verified! Redirecting…', 'success');
                setTimeout(() => { window.location.href = '/reset'; }, 1500);
            }
        } catch {
            showAlert(alert, 'Network error. Is the server running?');
        } finally {
            setLoading(btn, false, 'Verify OTP');
        }
    });
}

/* ─── Page 3: Reset Password (reset.html) ─────────────────── */
const resetForm = document.getElementById('resetForm');
if (resetForm) {
    const email = sessionStorage.getItem('otp_email');
    if (!email) window.location.replace('/forgot');

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('alert');
        const btn = document.getElementById('resetBtn');
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!newPassword || !confirmPassword) return showAlert(alert, 'Please fill all fields.');
        if (newPassword.length < 8) return showAlert(alert, 'Password must be at least 8 characters.');
        if (newPassword !== confirmPassword) return showAlert(alert, 'Passwords do not match.');
        hideAlert(alert);
        setLoading(btn, true, 'Reset Password');

        try {
            const res = await fetch(`${API}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                showAlert(alert, data.error || 'Password reset failed.');
            } else {
                sessionStorage.removeItem('otp_email');
                showAlert(alert, '✅ Password reset! Redirecting to login…', 'success');
                setTimeout(() => { window.location.href = '/'; }, 2000);
            }
        } catch {
            showAlert(alert, 'Network error. Is the server running?');
        } finally {
            setLoading(btn, false, 'Reset Password');
        }
    });
}
