// ===== Products Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allProducts = [];

export async function renderProducts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Products</h2>
        <p class="page-subtitle">Manage your product catalog</p>
      </div>
      <div style="display:flex; gap:12px; align-items:center;">
        <div class="search-bar">
          <span class="material-icons-outlined">search</span>
          <input type="text" id="product-search" placeholder="Search by SKU or Name..." />
        </div>
        <button class="btn btn-primary" id="btn-add-product">
          <span class="material-icons-outlined">add</span>
          Add Product
        </button>
      </div>
    </div>
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU / Code</th>
            <th>Category</th>
            <th>Unit of Measure</th>
            <th>Stock</th>
            <th>Min Threshold</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="products-tbody">
          <tr><td colspan="7" class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Load products
  await loadProducts();

  // Search
  document.getElementById('product-search').addEventListener('input', debounce(async (e) => {
    await loadProducts(e.target.value);
  }, 300));

  // Add product
  document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
}

async function loadProducts(search = '') {
  try {
    const url = search ? `/api/products?search=${encodeURIComponent(search)}` : '/api/products';
    const res = await fetch(url);
    allProducts = await res.json();
    renderProductsTable(allProducts);
  } catch (err) {
    showToast('Failed to load products', 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <span class="material-icons-outlined">inventory_2</span>
      <p>No products found</p>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-add-product').click()">Add your first product</button>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isLow = p.min_stock_threshold && p.initial_stock < p.min_stock_threshold;
    return `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td><code style="background:var(--bg-input);padding:3px 8px;border-radius:4px;font-size:12px;">${esc(p.sku)}</code></td>
        <td>${p.category_name ? esc(p.category_name) : '<span style="color:var(--text-muted)">Uncategorized</span>'}</td>
        <td>${esc(p.unit_of_measure)}</td>
        <td><span class="stock-badge ${isLow ? 'low' : 'ok'}">${p.initial_stock}</span></td>
        <td>${p.min_stock_threshold != null ? p.min_stock_threshold : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" data-edit="${p.id}" title="Edit"><span class="material-icons-outlined" style="font-size:18px;">edit</span></button>
            <button class="btn-icon danger" data-delete="${p.id}" title="Delete"><span class="material-icons-outlined" style="font-size:18px;">delete</span></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind actions
  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = allProducts.find(p => p.id === Number(btn.dataset.edit));
      if (product) openProductModal(product);
    });
  });

  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this product?')) return;
      try {
        const res = await fetch(`/api/products/${btn.dataset.delete}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Product deleted');
          await loadProducts();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to delete', 'error');
        }
      } catch { showToast('Failed to delete product', 'error'); }
    });
  });
}

async function openProductModal(product = null) {
  const isEdit = !!product;

  // Load categories for dropdown
  let categories = [];
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
  } catch (e) { /* ignore */ }

  const catOptions = categories.map(c =>
    `<option value="${c.id}" ${product && product.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  const formHtml = `
    <form id="product-form">
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input class="form-input" type="text" name="name" value="${product ? esc(product.name) : ''}" placeholder="Enter product name" required />
      </div>
      <div class="form-group">
        <label class="form-label">SKU / Code *</label>
        <input class="form-input" type="text" name="sku" value="${product ? esc(product.sku) : ''}" placeholder="e.g., SR-001" required />
        <p class="form-helper">Must be unique across all products</p>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" name="category_id">
          <option value="">— Select Category —</option>
          ${catOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unit of Measure *</label>
        <select class="form-select" name="unit_of_measure" required>
          <option value="" ${!product ? 'selected' : ''}>— Select Unit —</option>
          <option value="Kg" ${product?.unit_of_measure === 'Kg' ? 'selected' : ''}>Kg</option>
          <option value="Meters" ${product?.unit_of_measure === 'Meters' ? 'selected' : ''}>Meters</option>
          <option value="Pieces" ${product?.unit_of_measure === 'Pieces' ? 'selected' : ''}>Pieces</option>
          <option value="Liters" ${product?.unit_of_measure === 'Liters' ? 'selected' : ''}>Liters</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Initial Stock</label>
        <input class="form-input" type="number" name="initial_stock" value="${product ? product.initial_stock : ''}" placeholder="0" min="0" />
        <p class="form-helper">Optional — defaults to 0</p>
      </div>
      <div class="form-group">
        <label class="form-label">Min Stock Threshold</label>
        <input class="form-input" type="number" name="min_stock_threshold" value="${product?.min_stock_threshold ?? ''}" placeholder="Set for low-stock alerts" min="0" />
        <p class="form-helper">Alert triggers when stock falls below this</p>
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" id="cancel-product">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Product</button>
      </div>
    </form>
  `;

  openModal(isEdit ? 'Edit Product' : 'Add New Product', formHtml);

  document.getElementById('cancel-product').addEventListener('click', closeModal);

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = {
      name: formData.get('name'),
      sku: formData.get('sku'),
      category_id: formData.get('category_id') || null,
      unit_of_measure: formData.get('unit_of_measure'),
      initial_stock: formData.get('initial_stock') || null,
      min_stock_threshold: formData.get('min_stock_threshold') || null,
    };

    try {
      const url = isEdit ? `/api/products/${product.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Product ${isEdit ? 'updated' : 'created'} successfully`);
        closeModal();
        await loadProducts();
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

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
