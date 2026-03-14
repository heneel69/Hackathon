// ===== Stock Adjustments Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allAdjustments = [];

export async function renderAdjustments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Stock Adjustments</h2>
        <p class="page-subtitle">Reconcile recorded stock with physical counts</p>
      </div>
      <button class="btn btn-primary" id="btn-new-adjustment">
        <span class="material-icons-outlined">add</span>
        New Adjustment
      </button>
    </div>
    <div id="adjustments-list">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;
  await loadAdjustments();
  document.getElementById('btn-new-adjustment').addEventListener('click', () => openAdjustmentModal());
}

async function loadAdjustments() {
  try {
    const res = await fetch('/api/adjustments');
    allAdjustments = await res.json();
    renderAdjustmentsList();
  } catch { showToast('Failed to load adjustments', 'error'); }
}

function renderAdjustmentsList() {
  const list = document.getElementById('adjustments-list');
  if (!allAdjustments.length) {
    list.innerHTML = `<div class="empty-state"><span class="material-icons-outlined">tune</span><p>No adjustments yet</p></div>`;
    return;
  }

  list.innerHTML = `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr>
          <th>Product</th><th>SKU</th><th>Warehouse</th><th>Old Qty</th><th>New Qty</th><th>Diff</th><th>Reason</th><th>Date</th>
        </tr></thead>
        <tbody>${allAdjustments.map(a => {
          const diff = a.diff;
          const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';
          return `
            <tr>
              <td><strong>${esc(a.product_name)}</strong></td>
              <td><code style="background:var(--bg-input);padding:3px 8px;border-radius:4px;font-size:12px;">${esc(a.sku)}</code></td>
              <td>${esc(a.warehouse_name)}</td>
              <td>${a.old_quantity}</td>
              <td>${a.new_quantity}</td>
              <td><strong style="color:${diffColor}">${diff > 0 ? '+' : ''}${diff}</strong></td>
              <td style="color:var(--text-secondary);font-size:13px;">${a.reason ? esc(a.reason) : '—'}</td>
              <td style="color:var(--text-secondary);font-size:13px;">${new Date(a.created_at).toLocaleDateString()}</td>
            </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}

async function openAdjustmentModal() {
  let products = [], warehouses = [];
  try {
    [products, warehouses] = await Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json()),
    ]);
  } catch { /* ignore */ }

  openModal('New Stock Adjustment', `
    <form id="adjustment-form">
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select class="form-select" name="product_id" id="adj-product" required>
          <option value="">— Select Product —</option>
          ${products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Warehouse *</label>
        <select class="form-select" name="warehouse_id" id="adj-warehouse" required>
          <option value="">— Select Warehouse —</option>
          ${warehouses.filter(w => w.is_active).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div id="adj-current-stock" style="margin-bottom:16px;padding:12px;background:var(--bg-input);border-radius:var(--radius-sm);display:none;">
        <p style="font-size:13px;color:var(--text-secondary);">Current recorded stock: <strong id="adj-current-val" style="color:var(--text-primary);font-size:18px;">—</strong></p>
      </div>
      <div class="form-group">
        <label class="form-label">Physical Count (New Quantity) *</label>
        <input class="form-input" type="number" name="new_quantity" id="adj-new-qty" min="0" placeholder="Actual physical count" required />
        <p class="form-helper" id="adj-diff-display"></p>
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <input class="form-input" type="text" name="reason" placeholder="e.g., Damaged goods, Found on floor..." />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit Adjustment</button>
      </div>
    </form>
  `);

  // Live current stock lookup
  const fetchCurrentStock = async () => {
    const pid = document.getElementById('adj-product').value;
    const wid = document.getElementById('adj-warehouse').value;
    if (pid && wid) {
      try {
        const res = await fetch(`/api/products/${pid}/stock`);
        const data = await res.json();
        const whStock = data.stock.find(s => s.warehouse_id === Number(wid));
        const current = whStock ? whStock.quantity : 0;
        document.getElementById('adj-current-val').textContent = current;
        document.getElementById('adj-current-stock').style.display = 'block';
        document.getElementById('adj-current-stock').dataset.current = current;
        updateDiffDisplay();
      } catch { /* ignore */ }
    }
  };

  document.getElementById('adj-product').addEventListener('change', fetchCurrentStock);
  document.getElementById('adj-warehouse').addEventListener('change', fetchCurrentStock);

  document.getElementById('adj-new-qty').addEventListener('input', updateDiffDisplay);

  document.getElementById('adjustment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: fd.get('product_id'),
          warehouse_id: fd.get('warehouse_id'),
          new_quantity: Number(fd.get('new_quantity')),
          reason: fd.get('reason'),
        }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message); closeModal(); await loadAdjustments(); }
      else showToast(data.error, 'error');
    } catch { showToast('Network error', 'error'); }
  });
}

function updateDiffDisplay() {
  const currentEl = document.getElementById('adj-current-stock');
  const newQtyEl = document.getElementById('adj-new-qty');
  const diffEl = document.getElementById('adj-diff-display');
  if (!currentEl || !newQtyEl || !diffEl) return;

  const current = Number(currentEl.dataset.current || 0);
  const newQty = Number(newQtyEl.value);
  if (newQtyEl.value !== '') {
    const diff = newQty - current;
    const color = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';
    diffEl.innerHTML = `Adjustment: <strong style="color:${color}">${diff > 0 ? '+' : ''}${diff} units</strong>`;
  } else {
    diffEl.textContent = '';
  }
}

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
