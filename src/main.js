// ===== IMS SPA Router & App Init =====
import { renderProducts } from './pages/products.js';
import { renderCategories } from './pages/categories.js';
import { renderAlerts } from './pages/alerts.js';
import { renderSettings } from './pages/settings.js';

const mainContent = document.getElementById('main-content');
const navLinks = document.querySelectorAll('.nav-link');

const routes = {
  products: renderProducts,
  categories: renderCategories,
  alerts: renderAlerts,
  settings: renderSettings,
};

function navigate() {
  const hash = window.location.hash.replace('#', '') || 'products';
  const renderFn = routes[hash];

  // Update active nav
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.page === hash);
  });

  if (renderFn) {
    renderFn(mainContent);
  }

  // Update alert badge
  updateAlertBadge();
}

async function updateAlertBadge() {
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();
    const badge = document.getElementById('alert-badge');
    if (data.activeAlerts && data.activeAlerts.length > 0) {
      badge.textContent = data.activeAlerts.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    // Silently fail if server not ready
  }
}

// ===== Modal Helpers =====
export function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-backdrop').style.display = 'flex';
}

export function closeModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
});

// ===== Toast Helpers =====
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'warning';
  toast.innerHTML = `
    <span class="material-icons-outlined" style="color: var(--${type === 'error' ? 'danger' : type})">${icon}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Init =====
window.addEventListener('hashchange', navigate);
window.addEventListener('load', () => {
  if (!window.location.hash) window.location.hash = '#products';
  navigate();
});
