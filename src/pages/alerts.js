// ===== Alerts Page =====
import { showToast } from '../main.js';

export async function renderAlerts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Low Stock Alerts</h2>
        <p class="page-subtitle">Monitor inventory levels against thresholds</p>
      </div>
      <div class="alert-header-badge" id="alert-header-badge"></div>
    </div>
    <div id="alerts-content">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;

  await loadAlerts();
}

async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const data = await res.json();
    renderAlertsContent(data);
  } catch {
    showToast('Failed to load alerts', 'error');
  }
}

function renderAlertsContent({ activeAlerts, resolvedAlerts }) {
  const content = document.getElementById('alerts-content');
  const badge = document.getElementById('alert-header-badge');

  if (activeAlerts.length > 0) {
    badge.innerHTML = `<span class="stock-badge low" style="font-size:14px;padding:6px 14px;">${activeAlerts.length} Active Alert${activeAlerts.length > 1 ? 's' : ''}</span>`;
  } else {
    badge.innerHTML = `<span class="stock-badge ok" style="font-size:14px;padding:6px 14px;">All Clear</span>`;
  }

  let html = '';

  if (activeAlerts.length > 0) {
    html += `<div class="section-header"><span class="material-icons-outlined" style="color:var(--danger);">priority_high</span><h3>High Priority Alerts</h3></div>`;
    html += activeAlerts.map(a => {
      const pct = Math.min((a.current_stock / a.min_stock_threshold) * 100, 100);
      const severity = pct < 80 ? 'critical' : '';
      const barClass = pct < 50 ? 'danger' : pct < 80 ? 'warning' : 'success';
      return `
        <div class="alert-card ${severity}">
          <span class="material-icons-outlined alert-icon ${severity || 'warning'}">
            ${severity === 'critical' ? 'error' : 'warning'}
          </span>
          <div class="alert-info">
            <div class="alert-product">${esc(a.name)}</div>
            <div class="alert-detail">SKU: ${esc(a.sku)} · ${a.category_name || 'Uncategorized'} · ${esc(a.unit_of_measure)}</div>
            <div class="progress-bar-container">
              <div class="progress-bar ${barClass}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="alert-stock">
            <div class="alert-stock-value low">${a.current_stock}</div>
            <div class="alert-stock-label">of ${a.min_stock_threshold}</div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    html += `<div class="empty-state" style="padding:40px;">
      <span class="material-icons-outlined" style="color:var(--success);">check_circle</span>
      <p>No low-stock alerts — all products are above their thresholds!</p>
    </div>`;
  }

  if (resolvedAlerts.length > 0) {
    html += `<div class="section-header"><span class="material-icons-outlined" style="color:var(--success);">check_circle</span><h3>Above Threshold</h3></div>`;
    html += resolvedAlerts.map(a => `
      <div class="alert-card resolved">
        <span class="material-icons-outlined alert-icon resolved">check_circle</span>
        <div class="alert-info">
          <div class="alert-product">${esc(a.name)}</div>
          <div class="alert-detail">SKU: ${esc(a.sku)} · Stock: ${a.current_stock} / ${a.min_stock_threshold}</div>
        </div>
        <div class="alert-stock">
          <div class="alert-stock-value ok">${a.current_stock}</div>
          <div class="alert-stock-label">of ${a.min_stock_threshold}</div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = html;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
