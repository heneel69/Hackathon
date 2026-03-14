// ===== Receipts Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allReceipts = [];

export async function renderReceipts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Receipts</h2>
        <p class="page-subtitle">Manage incoming goods from suppliers</p>
      </div>
      <button class="btn btn-primary" id="btn-new-receipt">
        <span class="material-icons-outlined">add</span>
        New Receipt
      </button>
    </div>
    <div id="receipts-list">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;

  await loadReceipts();
  document.getElementById('btn-new-receipt').addEventListener('click', () => openNewReceiptModal());
}

async function loadReceipts() {
  try {
    const res = await fetch('/api/receipts');
    allReceipts = await res.json();
    renderReceiptsList();
  } catch { showToast('Failed to load receipts', 'error'); }
}

function renderReceiptsList() {
  const list = document.getElementById('receipts-list');
  if (!allReceipts.length) {
    list.innerHTML = `<div class="empty-state">
      <span class="material-icons-outlined">move_to_inbox</span>
      <p>No receipts yet</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>Supplier</th><th>Items</th><th>Total Units</th><th>Status</th><th>Created</th><th>Actions</th>
        </tr></thead>
        <tbody>${allReceipts.map(r => `
          <tr>
            <td>#${r.id}</td>
            <td><strong>${esc(r.supplier_name)}</strong></td>
            <td>${r.item_count}</td>
            <td>${r.total_units}</td>
            <td><span class="status-badge ${r.status === 'Validated' ? 'active' : 'inactive'}">${r.status}</span></td>
            <td style="color:var(--text-secondary);font-size:13px;">${new Date(r.created_at).toLocaleDateString()}</td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" data-view-receipt="${r.id}" title="View"><span class="material-icons-outlined" style="font-size:18px;">visibility</span></button>
                ${r.status === 'Draft' ? `
                  <button class="btn-icon" data-validate-receipt="${r.id}" title="Validate" style="color:var(--success);"><span class="material-icons-outlined" style="font-size:18px;">check_circle</span></button>
                  <button class="btn-icon danger" data-delete-receipt="${r.id}" title="Delete"><span class="material-icons-outlined" style="font-size:18px;">delete</span></button>
                ` : ''}
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>`;

  list.querySelectorAll('[data-view-receipt]').forEach(btn => {
    btn.addEventListener('click', () => viewReceipt(Number(btn.dataset.viewReceipt)));
  });
  list.querySelectorAll('[data-validate-receipt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Validate this receipt? Stock will be increased.')) return;
      try {
        const res = await fetch(`/api/receipts/${btn.dataset.validateReceipt}/validate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) { showToast('Receipt validated! Stock increased.'); await loadReceipts(); }
        else showToast(data.error, 'error');
      } catch { showToast('Failed to validate', 'error'); }
    });
  });
  list.querySelectorAll('[data-delete-receipt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this draft receipt?')) return;
      try {
        const res = await fetch(`/api/receipts/${btn.dataset.deleteReceipt}`, { method: 'DELETE' });
        if (res.ok) { showToast('Receipt deleted'); await loadReceipts(); }
      } catch { showToast('Failed to delete', 'error'); }
    });
  });
}

async function viewReceipt(id) {
  try {
    const res = await fetch(`/api/receipts/${id}`);
    const data = await res.json();
    const itemsHtml = data.items.length > 0
      ? `<table class="data-table" style="margin-top:12px;"><thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>Qty</th></tr></thead>
         <tbody>${data.items.map(i => `<tr><td>${esc(i.product_name)}</td><td><code>${esc(i.sku)}</code></td><td>${esc(i.warehouse_name)}</td><td>${i.quantity}</td></tr>`).join('')}</tbody></table>`
      : '<p style="color:var(--text-muted);margin-top:12px;">No items added yet.</p>';

    const addItemBtn = data.status === 'Draft'
      ? `<button class="btn btn-primary btn-sm" id="btn-add-receipt-item" style="margin-top:16px;"><span class="material-icons-outlined">add</span> Add Item</button>`
      : '';

    openModal(`Receipt #${data.id} — ${data.supplier_name}`,
      `<p><strong>Status:</strong> <span class="status-badge ${data.status === 'Validated' ? 'active' : 'inactive'}">${data.status}</span></p>
       ${data.notes ? `<p style="color:var(--text-secondary);margin-top:8px;">${esc(data.notes)}</p>` : ''}
       ${itemsHtml}${addItemBtn}`);

    if (data.status === 'Draft') {
      document.getElementById('btn-add-receipt-item')?.addEventListener('click', () => {
        closeModal();
        openAddItemModal(id);
      });
    }
  } catch { showToast('Failed to load receipt', 'error'); }
}

function openNewReceiptModal() {
  openModal('New Receipt', `
    <form id="receipt-form">
      <div class="form-group">
        <label class="form-label">Supplier Name *</label>
        <input class="form-input" type="text" name="supplier_name" placeholder="e.g., Global Steel Corp" required />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" name="notes" placeholder="Optional notes..." />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Receipt</button>
      </div>
    </form>
  `);
  document.getElementById('receipt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_name: fd.get('supplier_name'), notes: fd.get('notes') }),
      });
      if (res.ok) { showToast('Receipt created (Draft)'); closeModal(); await loadReceipts(); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

async function openAddItemModal(receiptId) {
  let products = [], warehouses = [];
  try {
    [products, warehouses] = await Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json()),
    ]);
  } catch { /* ignore */ }

  openModal('Add Item to Receipt', `
    <form id="receipt-item-form">
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select class="form-select" name="product_id" required>
          <option value="">— Select Product —</option>
          ${products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Destination Warehouse *</label>
        <select class="form-select" name="warehouse_id" required>
          <option value="">— Select Warehouse —</option>
          ${warehouses.filter(w => w.is_active).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity *</label>
        <input class="form-input" type="number" name="quantity" min="1" placeholder="Qty received" required />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Item</button>
      </div>
    </form>
  `);
  document.getElementById('receipt-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: fd.get('product_id'), warehouse_id: fd.get('warehouse_id'), quantity: Number(fd.get('quantity')) }),
      });
      if (res.ok) { showToast('Item added'); closeModal(); viewReceipt(receiptId); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
