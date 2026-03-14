// ===== Categories Page =====
import { openModal, closeModal, showToast } from '../main.js';

let allCategories = [];

export async function renderCategories(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Categories</h2>
        <p class="page-subtitle">Manage and organize your inventory classifications</p>
      </div>
      <button class="btn btn-primary" id="btn-add-category">
        <span class="material-icons-outlined">add</span>
        Add Category
      </button>
    </div>
    <div class="cards-grid" id="categories-grid">
      <div class="empty-state"><span class="material-icons-outlined">hourglass_empty</span>Loading...</div>
    </div>
  `;

  await loadCategories();

  document.getElementById('btn-add-category').addEventListener('click', () => openCategoryModal());
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    allCategories = await res.json();
    renderCategoriesGrid();
  } catch {
    showToast('Failed to load categories', 'error');
  }
}

function renderCategoriesGrid() {
  const grid = document.getElementById('categories-grid');

  const cardsHtml = allCategories.map(c => `
    <div class="card">
      <div class="card-meta">
        <span class="card-badge">
          <span class="material-icons-outlined" style="font-size:14px;">inventory_2</span>
          ${c.product_count} Product${c.product_count !== 1 ? 's' : ''}
        </span>
      </div>
      <h3 class="card-title">${esc(c.name)}</h3>
      <p class="card-desc">${c.description ? esc(c.description) : 'No description set'}</p>
      <div class="card-actions">
        <button class="btn-icon" data-edit-cat="${c.id}" title="Edit">
          <span class="material-icons-outlined" style="font-size:18px;">edit</span>
        </button>
        <button class="btn-icon danger" data-delete-cat="${c.id}" title="Delete">
          <span class="material-icons-outlined" style="font-size:18px;">delete</span>
        </button>
      </div>
    </div>
  `).join('');

  const addCard = `
    <div class="card add-card" id="add-category-card">
      <span class="material-icons-outlined">add_circle_outline</span>
      <p>Add New Category</p>
    </div>
  `;

  grid.innerHTML = cardsHtml + addCard;

  // Bind events
  document.getElementById('add-category-card').addEventListener('click', () => openCategoryModal());

  grid.querySelectorAll('[data-edit-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = allCategories.find(c => c.id === Number(btn.dataset.editCat));
      if (cat) openCategoryModal(cat);
    });
  });

  grid.querySelectorAll('[data-delete-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = allCategories.find(c => c.id === Number(btn.dataset.deleteCat));
      const msg = cat && cat.product_count > 0
        ? `Delete "${cat.name}"? ${cat.product_count} product(s) will become Uncategorized.`
        : `Delete "${cat?.name}"?`;
      if (!confirm(msg)) return;

      try {
        const res = await fetch(`/api/categories/${btn.dataset.deleteCat}`, { method: 'DELETE' });
        if (res.ok) {
          const data = await res.json();
          showToast(`Category deleted. ${data.productsSetToUncategorized} product(s) set to Uncategorized.`);
          await loadCategories();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to delete', 'error');
        }
      } catch { showToast('Failed to delete category', 'error'); }
    });
  });
}

function openCategoryModal(category = null) {
  const isEdit = !!category;
  const formHtml = `
    <form id="category-form">
      <div class="form-group">
        <label class="form-label">Category Name *</label>
        <input class="form-input" type="text" name="name" value="${category ? esc(category.name) : ''}" placeholder="e.g., Raw Materials" required />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" type="text" name="description" value="${category ? esc(category.description || '') : ''}" placeholder="Brief description..." />
      </div>
      <div class="form-footer">
        <button type="button" class="btn btn-ghost" id="cancel-cat">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Category</button>
      </div>
    </form>
  `;

  openModal(isEdit ? 'Edit Category' : 'Add New Category', formHtml);

  document.getElementById('cancel-cat').addEventListener('click', closeModal);

  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = { name: formData.get('name'), description: formData.get('description') };

    try {
      const url = isEdit ? `/api/categories/${category.id}` : '/api/categories';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`Category ${isEdit ? 'updated' : 'created'} successfully`);
        closeModal();
        await loadCategories();
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
