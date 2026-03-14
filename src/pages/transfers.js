// ===== Transfers Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allTransfers = [];

export async function renderTransfers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Internal Transfers</h2>
        <p class="page-subtitle">Move stock between warehouses and locations</p>
      </div>
      <button class="btn btn-primary" id="btn-new-transfer">
        <span class="material-icons-outlined">add</span>
        New Transfer
      </button>
    </div>
    <div id="transfers-list">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;
  await loadTransfers();
  document.getElementById('btn-new-transfer').addEventListener('click', () => openNewTransferModal());
}

async function loadTransfers() {
  try {
    const res = await fetch('/api/transfers');
    allTransfers = await res.json();
    renderTransfersList();
  } catch { showToast('Failed to load transfers', 'error'); }
}

function renderTransfersList() {
  const list = document.getElementById('transfers-list');
  if (!allTransfers.length) {
    list.innerHTML = `<div class="empty-state"><span class="material-icons-outlined">swap_horiz</span><p>No transfers yet</p></div>`;
    return;
  }

  list.innerHTML = `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>Source</th><th>Destination</th><th>Items</th><th>Units</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>${allTransfers.map(t => `
          <tr>
            <td>#${t.id}</td>
            <td><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--danger);">arrow_upward</span> ${esc(t.source_warehouse_name)}</td>
            <td><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--success);">arrow_downward</span> ${esc(t.dest_warehouse_name)}</td>
            <td>${t.item_count}</td>
            <td>${t.total_units}</td>
            <td><span class="status-badge ${t.status === 'Validated' ? 'active' : 'inactive'}">${t.status}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" data-view-tr="${t.id}" title="View"><span class="material-icons-outlined" style="font-size:18px;">visibility</span></button>
                ${t.status === 'Draft' ? `
                  <button class="btn-icon" data-validate-tr="${t.id}" title="Validate" style="color:var(--success);"><span class="material-icons-outlined" style="font-size:18px;">check_circle</span></button>
                  <button class="btn-icon danger" data-delete-tr="${t.id}" title="Delete"><span class="material-icons-outlined" style="font-size:18px;">delete</span></button>
                ` : ''}
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>`;

  list.querySelectorAll('[data-view-tr]').forEach(btn =>
    btn.addEventListener('click', () => viewTransfer(Number(btn.dataset.viewTr))));

  list.querySelectorAll('[data-validate-tr]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Validate transfer? Stock will move between warehouses.')) return;
      try {
        const res = await fetch(`/api/transfers/${btn.dataset.validateTr}/validate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) { showToast('Transfer validated! Stock moved.'); await loadTransfers(); }
        else showToast(data.error, 'error');
      } catch { showToast('Failed to validate', 'error'); }
    }));

  list.querySelectorAll('[data-delete-tr]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this draft transfer?')) return;
      try {
        const res = await fetch(`/api/transfers/${btn.dataset.deleteTr}`, { method: 'DELETE' });
        if (res.ok) { showToast('Transfer deleted'); await loadTransfers(); }
      } catch { showToast('Failed', 'error'); }
    }));
}

async function viewTransfer(id) {
  try {
    const res = await fetch(`/api/transfers/${id}`);
    const data = await res.json();
    const itemsHtml = data.items.length > 0
      ? `<table class="data-table" style="margin-top:12px;"><thead><tr><th>Product</th><th>SKU</th><th>Qty</th></tr></thead>
         <tbody>${data.items.map(i => `<tr><td>${esc(i.product_name)}</td><td><code>${esc(i.sku)}</code></td><td>${i.quantity}</td></tr>`).join('')}</tbody></table>`
      : '<p style="color:var(--text-muted);margin-top:12px;">No items added.</p>';

    const addBtn = data.status === 'Draft'
      ? `<button class="btn btn-primary btn-sm" id="btn-add-tr-item" style="margin-top:16px;"><span class="material-icons-outlined">add</span> Add Item</button>`
      : '';

    openModal(`Transfer #${data.id}`,
      `<p><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--danger);">arrow_upward</span> <strong>From:</strong> ${esc(data.source_warehouse_name)}</p>
       <p><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--success);">arrow_downward</span> <strong>To:</strong> ${esc(data.dest_warehouse_name)}</p>
       <p style="margin-top:8px;"><strong>Status:</strong> <span class="status-badge ${data.status === 'Validated' ? 'active' : 'inactive'}">${data.status}</span></p>
       ${itemsHtml}${addBtn}`);

    document.getElementById('btn-add-tr-item')?.addEventListener('click', () => {
      closeModal(); openAddTransferItemModal(id);
    });
  } catch { showToast('Failed to load transfer', 'error'); }
}

async function openNewTransferModal() {
  let warehouses = [];
  try { warehouses = await fetch('/api/warehouses').then(r => r.json()); } catch { /* */ }
  const activeWhs = warehouses.filter(w => w.is_active);

  openModal('New Internal Transfer', `
    <form id="transfer-form">
      <div class="form-group">
        <label class="form-label">Source Warehouse *</label>
        <select class="form-select" name="source_warehouse_id" required>
          <option value="">— Select Source —</option>
          ${activeWhs.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Destination Warehouse *</label>
        <select class="form-select" name="dest_warehouse_id" required>
          <option value="">— Select Destination —</option>
          ${activeWhs.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" name="notes" placeholder="Optional notes..." />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Transfer</button>
      </div>
    </form>
  `);

  const sourceSelect = document.querySelector('select[name="source_warehouse_id"]');
  const destSelect = document.querySelector('select[name="dest_warehouse_id"]');

  sourceSelect.addEventListener('change', () => {
    const selectedSource = sourceSelect.value;
    Array.from(destSelect.options).forEach(opt => {
      if (opt.value === '') return;
      opt.disabled = (opt.value === selectedSource);
    });
    if (destSelect.value === selectedSource) {
      destSelect.value = '';
    }
  });

  document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_warehouse_id: fd.get('source_warehouse_id'), dest_warehouse_id: fd.get('dest_warehouse_id'), notes: fd.get('notes') }),
      });
      if (res.ok) { showToast('Transfer created (Draft)'); closeModal(); await loadTransfers(); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

async function openAddTransferItemModal(transferId) {
  let products = [];
  try { products = await fetch('/api/products').then(r => r.json()); } catch { /* */ }

  openModal('Add Item to Transfer', `
    <form id="tr-item-form">
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select class="form-select" name="product_id" required>
          <option value="">— Select Product —</option>
          ${products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity *</label>
        <input class="form-input" type="number" name="quantity" min="1" placeholder="Units to transfer" required />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Item</button>
      </div>
    </form>
  `);
  document.getElementById('tr-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`/api/transfers/${transferId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: fd.get('product_id'), quantity: Number(fd.get('quantity')) }),
      });
      if (res.ok) { showToast('Item added'); closeModal(); viewTransfer(transferId); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
