import { showToast } from '../main.js';

let currentFilters = {
  type: '',
  status: '',
  warehouse_id: '',
  category_id: ''
};

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Dashboard</h2>
        <p class="page-subtitle">Real-time overview of inventory operations</p>
      </div>
    </div>
    
    <div id="dashboard-kpis" class="stats-row" style="margin-top:0; margin-bottom: 24px;">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading KPIs...</div>
    </div>

    <div class="dashboard-filters" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
      <select id="filter-type" class="form-select" style="width: 200px;">
        <option value="">All Document Types</option>
        <option value="Receipts">Receipts</option>
        <option value="Deliveries">Deliveries</option>
        <option value="Transfers">Internal Transfers</option>
        <option value="Adjustments">Adjustments</option>
      </select>
      <select id="filter-status" class="form-select" style="width: 200px;">
        <option value="">All Statuses</option>
        <option value="Draft">Draft</option>
        <option value="Waiting">Waiting</option>
        <option value="Ready">Ready</option>
        <option value="Validated">Validated</option>
        <option value="Done">Done</option>
        <option value="Canceled">Canceled</option>
      </select>
      <select id="filter-warehouse" class="form-select" style="width: 200px;">
        <option value="">All Warehouses</option>
      </select>
      <select id="filter-category" class="form-select" style="width: 200px;">
        <option value="">All Categories</option>
      </select>
    </div>

    <h3 style="margin-bottom: 12px; font-size: 16px;">Active Operations</h3>
    <div id="dashboard-operations">
       <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading Data...</div>
    </div>
  `;

  await loadFilterOptions();
  await loadKPIs();
  await loadOperations();

  // Attach event listeners to filters
  document.getElementById('filter-type').addEventListener('change', (e) => { currentFilters.type = e.target.value; loadOperations(); });
  document.getElementById('filter-status').addEventListener('change', (e) => { currentFilters.status = e.target.value; loadOperations(); });
  document.getElementById('filter-warehouse').addEventListener('change', (e) => { currentFilters.warehouse_id = e.target.value; loadOperations(); });
  document.getElementById('filter-category').addEventListener('change', (e) => { currentFilters.category_id = e.target.value; loadOperations(); });
}

async function loadKPIs() {
  try {
    const res = await fetch('/api/dashboard/kpis');
    const kpis = await res.json();
    const container = document.getElementById('dashboard-kpis');
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Products in Stock</div>
        <div class="stat-value">${kpis.totalProductsInStock}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Low / Out of Stock</div>
        <div class="stat-value" style="color: var(--danger);">${kpis.lowStockItems}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending Receipts</div>
        <div class="stat-value" style="color: var(--warning);">${kpis.pendingReceipts}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending Deliveries</div>
        <div class="stat-value" style="color: var(--warning);">${kpis.pendingDeliveries}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Transfers Scheduled</div>
        <div class="stat-value" style="color: var(--warning);">${kpis.internalTransfersScheduled}</div>
      </div>
    `;
  } catch {
    showToast('Failed to load KPIs', 'error');
  }
}

async function loadFilterOptions() {
  try {
    const [warehouses, categories] = await Promise.all([
      fetch('/api/warehouses').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]);
    const wSelect = document.getElementById('filter-warehouse');
    warehouses.forEach(w => {
      wSelect.innerHTML += `<option value="${w.id}">${esc(w.name)}</option>`;
    });
    const cSelect = document.getElementById('filter-category');
    categories.forEach(c => {
      cSelect.innerHTML += `<option value="${c.id}">${esc(c.name)}</option>`;
    });
  } catch {
    // silently fail
  }
}

async function loadOperations() {
  const list = document.getElementById('dashboard-operations');
  list.innerHTML = `<div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading Data...</div>`;
  try {
    const params = new URLSearchParams();
    if (currentFilters.type) params.append('type', currentFilters.type);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.warehouse_id) params.append('warehouse_id', currentFilters.warehouse_id);
    if (currentFilters.category_id) params.append('category_id', currentFilters.category_id);

    const res = await fetch(`/api/dashboard/operations?${params.toString()}`);
    const data = await res.json();
    
    if (!data.operations || !data.operations.length) {
      list.innerHTML = `<div class="empty-state">
        <span class="material-icons-outlined">search_off</span>
        <p>No operations match the filters</p>
      </div>`;
      return;
    }

    list.innerHTML = `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr>
            <th>Type</th><th>ID</th><th>Status</th><th>Product</th><th>Category</th><th>Warehouse</th><th>Qty</th><th>Date</th>
          </tr></thead>
          <tbody>${data.operations.map(op => `
            <tr>
              <td><strong>${op.type}</strong></td>
              <td>#${op.operation_id}</td>
              <td><span class="status-badge ${(op.status === 'Validated' || op.status === 'Done') ? 'active' : 'inactive'}">${op.status}</span></td>
              <td>${esc(op.product_name)}</td>
              <td>${esc(op.category_name) || '-'}</td>
              <td>${esc(op.warehouse_name)}</td>
              <td>${op.quantity}</td>
              <td style="color:var(--text-secondary);font-size:13px;">${new Date(op.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
  } catch {
    showToast('Failed to load Operations data', 'error');
  }
}

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
