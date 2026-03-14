/* ─── dashboard.js — Dashboard & Profile page logic ─────────── */
const API = '/api/auth';
const token = localStorage.getItem('ims_token');

// ── GUARD: redirect to login if no token ──────────────────────
if (!token) {
    window.location.replace('/');
}

// ── FETCH USER INFO & POPULATE SIDEBAR ───────────────────────
async function loadUser() {
    try {
        const res = await fetch(`${API}/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            // Token expired or invalid — clear and redirect
            localStorage.removeItem('ims_token');
            localStorage.removeItem('ims_user');
            window.location.replace('/');
            return;
        }
        const { user } = await res.json();
        populateSidebar(user);
        populateProfilePage(user);
    } catch {
        // Use cached data if network fails
        const cached = JSON.parse(localStorage.getItem('ims_user') || 'null');
        if (cached) {
            populateSidebar(cached);
            populateProfilePage(cached);
        }
    }
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
}

function populateSidebar(user) {
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    const roleEl = document.getElementById('sidebarRole');
    const badgeEl = document.getElementById('roleBadge');
    if (avatarEl) avatarEl.textContent = getInitials(user.name);
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role;
    if (badgeEl) badgeEl.textContent = user.role;
}

function populateProfilePage(user) {
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRoleBadge');
    const detailName = document.getElementById('detailName');
    const detailEmail = document.getElementById('detailEmail');
    const detailRole = document.getElementById('detailRole');
    const detailCreated = document.getElementById('detailCreated');

    if (profileAvatar) profileAvatar.textContent = getInitials(user.name);
    if (profileName) profileName.textContent = user.name;
    if (profileRole) profileRole.textContent = user.role;
    if (detailName) detailName.textContent = user.name;
    if (detailEmail) detailEmail.textContent = user.email;
    if (detailRole) detailRole.textContent = user.role;
    if (detailCreated) detailCreated.textContent = formatDate(user.created_at);
}

// ── PROFILE DROPDOWN TOGGLE ───────────────────────────────────
const profileMenuBtn = document.getElementById('profileMenuBtn');
const profileDropdown = document.getElementById('profileDropdown');

if (profileMenuBtn && profileDropdown) {
    profileMenuBtn.addEventListener('click', () => {
        const isOpen = profileDropdown.classList.contains('open');
        profileDropdown.classList.toggle('open', !isOpen);
        profileMenuBtn.classList.toggle('open', !isOpen);
        profileMenuBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('open');
            profileMenuBtn.classList.remove('open');
        }
    });
}

// ── LOGOUT ────────────────────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('ims_token');
        localStorage.removeItem('ims_user');
        window.location.replace('/');
    });
}

// ── INIT ──────────────────────────────────────────────────────
loadUser();
