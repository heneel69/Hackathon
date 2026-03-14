// ===== Settings / General / Users / Warehouses Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allWarehouses = [];
let allUsers = [];
let appSettings = {};
let currentTab = 'warehouses';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Settings</h2>
        <p class="page-subtitle">Configure your system preferences</p>
      </div>
    </div>
    <div class="tabs">
      <button class="tab" data-tab="warehouses">Warehouses</button>
      <button class="tab" data-tab="general">General</button>
      <button class="tab" data-tab="users">Users</button>
    </div>
    <div id="settings-content" style="margin-top: 20px;"></div>
  `;

  // Bind tab switching
  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      renderActiveTab(container);
    });
  });

  renderActiveTab(container);
}

function renderActiveTab(container) {
  // Update UI active state
  container.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  });

  const content = container.querySelector('#settings-content');

  if (currentTab === 'warehouses') {
    renderWarehousesTab(content);
  } else if (currentTab === 'general') {
    renderGeneralTab(content);
  } else if (currentTab === 'users') {
    renderUsersTab(content);
  }
}

// ==========================================================
// WAREHOUSES TAB
// ==========================================================
async function renderWarehousesTab(content) {
  content.innerHTML = `
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

  document.getElementById('btn-add-warehouse').addEventListener('click', () => openWarehouseModal());
  await loadWarehouses();
}

async function loadWarehouses() {
  if (currentTab !== 'warehouses') return;
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
  if (!list) return;

  if (!allWarehouses.length) {
    list.innerHTML = `<div class="empty-state">
      <span class="material-icons-outlined">warehouse</span>
      <p>No warehouses configured yet</p>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-add-warehouse').click()">Add your first warehouse</button>
    </div>`;
    if(stats) stats.innerHTML = '';
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
          <span><strong>${Number(w.total_units || 0).toLocaleString()}</strong> units</span>
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

  if (stats) {
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
          <div class="stat-meta">${mostActive ? `${Number(mostActive.total_units || 0).toLocaleString()} units` : 'No data'}</div>
        </div>
      </div>
    `;
  }

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
        <input class="form-input" type="text" name="name" value="${warehouse ? esc(warehouse.name) : ''}" placeholder="e.g., Warehouse 1" required />
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
    } catch { showToast('Network error', 'error'); }
  });
}

// ==========================================================
// GENERAL SETTINGS TAB
// ==========================================================
async function renderGeneralTab(content) {
  content.innerHTML = `
    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:24px;">
      <h3 style="margin-bottom:20px; font-weight:600;">System Preferences</h3>
      <form id="general-settings-form">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
          <div class="form-group">
            <label class="form-label">Company Name</label>
            <input class="form-input" type="text" name="companyName" id="setting-company" placeholder="e.g., Acme Corp" />
          </div>
          <div class="form-group">
            <label class="form-label">Currency Symbol</label>
            <input class="form-input" type="text" name="currencySymbol" id="setting-currency" placeholder="e.g., $, €, £" defaultValue="$" />
          </div>
          <div class="form-group">
            <label class="form-label">Date Format</label>
            <select class="form-input" name="dateFormat" id="setting-date">
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Low Stock Alert Global Threshold</label>
            <input class="form-input" type="number" name="globalLowStock" id="setting-lowstock" placeholder="e.g., 50" defaultValue="50" />
          </div>
        </div>
        <div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border-color); text-align:right;">
          <button type="submit" class="btn btn-primary" id="btn-save-general">
            <span class="material-icons-outlined">save</span> Save Settings
          </button>
        </div>
      </form>
    </div>
  `;

  await loadGeneralSettings();

  document.getElementById('general-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const settingsObj = {
      companyName: formData.get('companyName'),
      currencySymbol: formData.get('currencySymbol'),
      dateFormat: formData.get('dateFormat'),
      globalLowStock: formData.get('globalLowStock')
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsObj })
      });
      if (res.ok) {
        showToast('Settings saved successfully');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch { showToast('Network error', 'error'); }
  });
}

async function loadGeneralSettings() {
  if (currentTab !== 'general') return;
  try {
    const res = await fetch('/api/settings');
    appSettings = await res.json();
    
    document.getElementById('setting-company').value = appSettings.companyName || '';
    document.getElementById('setting-currency').value = appSettings.currencySymbol || '$';
    document.getElementById('setting-date').value = appSettings.dateFormat || 'YYYY-MM-DD';
    document.getElementById('setting-lowstock').value = appSettings.globalLowStock || '50';
  } catch {
    showToast('Failed to load settings', 'error');
  }
}

// ==========================================================
// USERS TAB
// ==========================================================
async function renderUsersTab(content) {
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:600;">System Users</h3>
    </div>
    <div class="data-table-container">
      <table class="data-table" style="width:100%; text-align:left;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          <tr><td colspan="6" style="text-align:center;">Loading users...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  await loadUsers();
}

async function loadUsers() {
  if (currentTab !== 'users') return;
  try {
    const res = await fetch('/api/users');
    allUsers = await res.json();
    renderUsersList();
  } catch {
    showToast('Failed to load users', 'error');
  }
}

function renderUsersList() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (!allUsers.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td><div style="font-weight:500;">${esc(u.name)}</div></td>
      <td>${esc(u.email)}</td>
      <td>
        <span class="status-badge ${u.role.includes('Manager') ? 'active' : 'draft'}">
          ${u.role}
        </span>
      </td>
      <td>
        ${u.is_validated 
          ? '<span style="color:var(--primary);"><span class="material-icons-outlined" style="font-size:16px;vertical-align:text-bottom;">check_circle</span> Validated</span>' 
          : '<span style="color:var(--warning);"><span class="material-icons-outlined" style="font-size:16px;vertical-align:text-bottom;">pending</span> Pending</span>'
        }
      </td>
      <td style="color:var(--text-muted);font-size:13px;">${new Date(u.created_at).toLocaleDateString()}</td>
      <td style="text-align:right;">
        ${!u.is_validated ? 
          `<button class="btn btn-sm btn-ghost" onclick="validateUser(${u.id})" title="Validate User" style="color:var(--primary);">
            <span class="material-icons-outlined" style="font-size:18px;">how_to_reg</span> Validate
          </button>` : 
          `<button class="btn btn-sm btn-ghost" onclick="invalidateUser(${u.id})" title="Revoke Validation" style="color:var(--warning);">
            <span class="material-icons-outlined" style="font-size:18px;">block</span> Revoke
          </button>`
        }
        <button class="btn btn-sm btn-ghost" onclick="deleteUser(${u.id})" title="Delete User" style="color:var(--danger);">
          <span class="material-icons-outlined" style="font-size:18px;">delete</span> Delete
        </button>
      </td>
    </tr>
  `).join('');
}

// Global functions for user actions since they are inline onclick
window.validateUser = async (id) => updateValidation(id, true);
window.invalidateUser = async (id) => updateValidation(id, false);

async function updateValidation(id, isValidated) {
  try {
    const res = await fetch(`/api/users/${id}/validate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_validated: isValidated })
    });
    if (res.ok) {
      showToast(isValidated ? 'User validated' : 'User validation revoked');
      await loadUsers();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to update user', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

window.deleteUser = async (id) => {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('User deleted successfully');
      await loadUsers();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch {
    showToast('Network error', 'error');
  }
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
