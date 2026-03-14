// ===== Deliveries Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allDeliveries = [];

export async function renderDeliveries(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Delivery Orders</h2>
        <p class="page-subtitle">Manage outgoing goods to customers</p>
      </div>
      <button class="btn btn-primary" id="btn-new-delivery">
        <span class="material-icons-outlined">add</span>
        New Delivery Order
      </button>
    </div>
    <div id="deliveries-list">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;
  await loadDeliveries();
  document.getElementById('btn-new-delivery').addEventListener('click', () => openNewDeliveryModal());
}

async function loadDeliveries() {
  try {
    const res = await fetch('/api/deliveries');
    allDeliveries = await res.json();
    renderDeliveriesList();
  } catch { showToast('Failed to load deliveries', 'error'); }
}

const statusColors = { Draft:'inactive', Picking:'', Packing:'', Validated:'active' };
const statusIcons = { Draft:'edit_note', Picking:'inventory_2', Packing:'package_2', Validated:'check_circle' };

function renderDeliveriesList() {
  const list = document.getElementById('deliveries-list');
  if (!allDeliveries.length) {
    list.innerHTML = `<div class="empty-state"><span class="material-icons-outlined">local_shipping</span><p>No delivery orders yet</p></div>`;
    return;
  }

  list.innerHTML = `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>Customer</th><th>Items</th><th>Units</th><th>Status</th><th>Created</th><th>Actions</th>
        </tr></thead>
        <tbody>${allDeliveries.map(d => `
          <tr>
            <td>#${d.id}</td>
            <td><strong>${esc(d.customer_name)}</strong></td>
            <td>${d.item_count}</td>
            <td>${d.total_units}</td>
            <td><span class="status-badge ${statusColors[d.status] || ''}" style="${!statusColors[d.status] ? 'background:var(--warning-bg);color:var(--warning);' : ''}">${d.status}</span></td>
            <td style="color:var(--text-secondary);font-size:13px;">${new Date(d.created_at).toLocaleDateString()}</td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" data-view-del="${d.id}" title="View"><span class="material-icons-outlined" style="font-size:18px;">visibility</span></button>
                ${d.status === 'Draft' ? `<button class="btn-icon" data-advance-del="${d.id}" data-next="Picking" title="Start Picking" style="color:var(--warning);"><span class="material-icons-outlined" style="font-size:18px;">inventory_2</span></button>` : ''}
                ${d.status === 'Picking' ? `<button class="btn-icon" data-advance-del="${d.id}" data-next="Packing" title="Start Packing" style="color:var(--warning);"><span class="material-icons-outlined" style="font-size:18px;">package_2</span></button>` : ''}
                ${d.status !== 'Validated' ? `<button class="btn-icon" data-validate-del="${d.id}" title="Validate" style="color:var(--success);"><span class="material-icons-outlined" style="font-size:18px;">check_circle</span></button>` : ''}
                ${d.status !== 'Validated' ? `<button class="btn-icon danger" data-delete-del="${d.id}" title="Delete"><span class="material-icons-outlined" style="font-size:18px;">delete</span></button>` : ''}
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>`;

  list.querySelectorAll('[data-view-del]').forEach(btn =>
    btn.addEventListener('click', () => viewDelivery(Number(btn.dataset.viewDel))));

  list.querySelectorAll('[data-advance-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/deliveries/${btn.dataset.advanceDel}/status`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: btn.dataset.next }),
        });
        if (res.ok) { showToast(`Status → ${btn.dataset.next}`); await loadDeliveries(); }
        else { const d = await res.json(); showToast(d.error, 'error'); }
      } catch { showToast('Failed', 'error'); }
    }));

  list.querySelectorAll('[data-validate-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Validate delivery? Stock will be decreased.')) return;
      try {
        const res = await fetch(`/api/deliveries/${btn.dataset.validateDel}/validate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) { showToast('Delivery validated! Stock decreased.'); await loadDeliveries(); }
        else showToast(data.error, 'error');
      } catch { showToast('Failed to validate', 'error'); }
    }));

  list.querySelectorAll('[data-delete-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this delivery order?')) return;
      try {
        const res = await fetch(`/api/deliveries/${btn.dataset.deleteDel}`, { method: 'DELETE' });
        if (res.ok) { showToast('Delivery deleted'); await loadDeliveries(); }
      } catch { showToast('Failed', 'error'); }
    }));
}

async function viewDelivery(id) {
  try {
    const res = await fetch(`/api/deliveries/${id}`);
    const data = await res.json();
    const itemsHtml = data.items.length > 0
      ? `<table class="data-table" style="margin-top:12px;"><thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>Qty</th></tr></thead>
         <tbody>${data.items.map(i => `<tr><td>${esc(i.product_name)}</td><td><code>${esc(i.sku)}</code></td><td>${esc(i.warehouse_name)}</td><td>${i.quantity}</td></tr>`).join('')}</tbody></table>`
      : '<p style="color:var(--text-muted);margin-top:12px;">No items added.</p>';

    const addBtn = data.status !== 'Validated'
      ? `<button class="btn btn-primary btn-sm" id="btn-add-del-item" style="margin-top:16px;"><span class="material-icons-outlined">add</span> Add Item</button>`
      : '';

    openModal(`Delivery #${data.id} — ${data.customer_name}`,
      `<p><strong>Status:</strong> <span class="status-badge ${statusColors[data.status] || ''}" style="${!statusColors[data.status] ? 'background:var(--warning-bg);color:var(--warning);' : ''}">${data.status}</span></p>
       ${itemsHtml}${addBtn}`);

    document.getElementById('btn-add-del-item')?.addEventListener('click', () => {
      closeModal(); openAddDeliveryItemModal(id);
    });
  } catch { showToast('Failed to load delivery', 'error'); }
}

function openNewDeliveryModal() {
  openModal('New Delivery Order', `
    <form id="delivery-form">
      <div class="form-group">
        <label class="form-label">Customer Name *</label>
        <input class="form-input" type="text" name="customer_name" placeholder="e.g., Acme Corporation" required />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" name="notes" placeholder="Optional notes..." />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Delivery</button>
      </div>
    </form>
  `);
  document.getElementById('delivery-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: fd.get('customer_name'), notes: fd.get('notes') }),
      });
      if (res.ok) { showToast('Delivery created (Draft)'); closeModal(); await loadDeliveries(); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

async function openAddDeliveryItemModal(deliveryId) {
  let products = [], warehouses = [];
  try {
    [products, warehouses] = await Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/warehouses').then(r => r.json()),
    ]);
  } catch { /* ignore */ }

  openModal('Add Item to Delivery', `
    <form id="del-item-form">
      <div class="form-group">
        <label class="form-label">Product *</label>
        <select class="form-select" name="product_id" required>
          <option value="">— Select Product —</option>
          ${products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)}) — Stock: ${p.initial_stock}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">From Warehouse *</label>
        <select class="form-select" name="warehouse_id" required>
          <option value="">— Select Warehouse —</option>
          ${warehouses.filter(w => w.is_active).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity *</label>
        <input class="form-input" type="number" name="quantity" min="1" placeholder="Qty to deliver" required />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Item</button>
      </div>
    </form>
  `);
  document.getElementById('del-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: fd.get('product_id'), warehouse_id: fd.get('warehouse_id'), quantity: Number(fd.get('quantity')) }),
      });
      if (res.ok) { showToast('Item added'); closeModal(); viewDelivery(deliveryId); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch { showToast('Network error', 'error'); }
  });
}

function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
