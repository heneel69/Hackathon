// ===== Settings / Warehouse Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allWarehouses = [];

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Settings</h2>
        <p class="page-subtitle">Configure your warehouse locations</p>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active">Warehouses</button>
      <button class="tab" disabled style="opacity:0.4;">General</button>
      <button class="tab" disabled style="opacity:0.4;">Users</button>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:600;">Warehouse Management</h3>
      <button class="btn btn-primary" id="btn-add-warehouse">
        <span class="material-icons-outlined">add</span>
        Add Warehouse
      </button>
    </div>
    <div id="warehouses-list">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
    <div id="warehouse-stats"></div>
  `;

  await loadWarehouses();

  document.getElementById('btn-add-warehouse').addEventListener('click', () => openWarehouseModal());
}

async function loadWarehouses() {
  try {
    const res = await fetch('/api/warehouses');
    allWarehouses = await res.json();
    renderWarehousesList();
  } catch {
    showToast('Failed to load warehouses', 'error');
  }
}

function renderWarehousesList() {
  const list = document.getElementById('warehouses-list');
  const stats = document.getElementById('warehouse-stats');

  if (!allWarehouses.length) {
    list.innerHTML = `<div class="empty-state">
      <span class="material-icons-outlined">warehouse</span>
      <p>No warehouses configured yet</p>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-add-warehouse').click()">Add your first warehouse</button>
    </div>`;
    stats.innerHTML = '';
    return;
  }

  list.innerHTML = allWarehouses.map(w => `
    <div class="warehouse-card">
      <div class="warehouse-header">
        <div>
          <span class="warehouse-name">${esc(w.name)}</span>
        </div>
        <span class="status-badge ${w.is_active ? 'active' : 'inactive'}">
          ${w.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      ${w.address ? `<div class="warehouse-address"><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">location_on</span>${esc(w.address)}</div>` : ''}
      <div class="warehouse-stats">
        <div class="warehouse-stat">
          <span class="material-icons-outlined">inventory_2</span>
          <span><strong>${w.product_count}</strong> Products stored</span>
        </div>
        <div class="warehouse-stat">
          <span class="material-icons-outlined">straighten</span>
          <span><strong>${Number(w.total_units).toLocaleString()}</strong> units</span>
        </div>
      </div>
      <div class="warehouse-actions">
        <button class="btn btn-ghost btn-sm" data-edit-wh="${w.id}">
          <span class="material-icons-outlined" style="font-size:16px;">edit</span> Edit
        </button>
        <button class="btn ${w.is_active ? 'btn-ghost' : 'btn-primary'} btn-sm" data-toggle-wh="${w.id}" data-active="${w.is_active}">
          <span class="material-icons-outlined" style="font-size:16px;">${w.is_active ? 'toggle_off' : 'toggle_on'}</span>
          ${w.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  `).join('');

  // Stats
  const totalProducts = allWarehouses.reduce((s, w) => s + (w.product_count || 0), 0);
  const totalUnits = allWarehouses.reduce((s, w) => s + (Number(w.total_units) || 0), 0);
  const activeCount = allWarehouses.filter(w => w.is_active).length;
  const mostActive = [...allWarehouses].sort((a, b) => (Number(b.total_units) || 0) - (Number(a.total_units) || 0))[0];

  stats.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Warehouses</div>
        <div class="stat-value">${allWarehouses.length}</div>
        <div class="stat-meta">${activeCount} active, ${allWarehouses.length - activeCount} inactive</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Stock Units</div>
        <div class="stat-value">${totalUnits.toLocaleString()}</div>
        <div class="stat-meta">Across ${totalProducts} products</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Most Active Warehouse</div>
        <div class="stat-value" style="font-size:20px;">${mostActive ? esc(mostActive.name) : '—'}</div>
        <div class="stat-meta">${mostActive ? `${Number(mostActive.total_units).toLocaleString()} units` : 'No data'}</div>
      </div>
    </div>
  `;

  // Bind events
  list.querySelectorAll('[data-edit-wh]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wh = allWarehouses.find(w => w.id === Number(btn.dataset.editWh));
      if (wh) openWarehouseModal(wh);
    });
  });

  list.querySelectorAll('[data-toggle-wh]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleWh;
      const isCurrentlyActive = btn.dataset.active === '1';

      if (isCurrentlyActive) {
        // Deactivate
        try {
          const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Warehouse deactivated');
            await loadWarehouses();
          }
        } catch { showToast('Failed to deactivate', 'error'); }
      } else {
        // Activate
        try {
          const res = await fetch(`/api/warehouses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true }),
          });
          if (res.ok) {
            showToast('Warehouse activated');
            await loadWarehouses();
          }
        } catch { showToast('Failed to activate', 'error'); }
      }
    });
  });
}

function openWarehouseModal(warehouse = null) {
  const isEdit = !!warehouse;
  const formHtml = `
    <form id="warehouse-form">
      <div class="form-group">
        <label class="form-label">Warehouse Name *</label>
        <input class="form-input" type="text" name="name" value="${warehouse ? esc(warehouse.name) : ''}" placeholder="e.g., Warehouse 1 — Main Facility" required />
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-input" type="text" name="address" value="${warehouse ? esc(warehouse.address || '') : ''}" placeholder="e.g., 123 Industrial Way" />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" id="cancel-wh">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Warehouse</button>
      </div>
    </form>
  `;

  openModal(isEdit ? 'Edit Warehouse' : 'Add New Warehouse', formHtml);

  document.getElementById('cancel-wh').addEventListener('click', closeModal);

  document.getElementById('warehouse-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = { name: formData.get('name'), address: formData.get('address') };

    try {
      const url = isEdit ? `/api/warehouses/${warehouse.id}` : '/api/warehouses';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Warehouse ${isEdit ? 'updated' : 'created'} successfully`);
        closeModal();
        await loadWarehouses();
      } else {
        showToast(data.error || 'Operation failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
