import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/categories — List all categories with product count
router.get('/', (req, res) => {
  try {
    const categories = queryAll(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c LEFT JOIN products p ON c.id = p.category_id
       GROUP BY c.id ORDER BY c.name ASC`
    );
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', (req, res) => {
  try {
    const category = queryOne('SELECT * FROM categories WHERE id = ?', [Number(req.params.id)]);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    const existing = queryOne('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing) return res.status(409).json({ error: 'A category with this name already exists.' });

    const result = runSql('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || '']);
    const category = queryOne('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;
    const existing = queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    if (name && name !== existing.name) {
      const nameCheck = queryOne('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id]);
      if (nameCheck) return res.status(409).json({ error: 'A category with this name already exists.' });
    }

    runSql('UPDATE categories SET name = ?, description = ? WHERE id = ?', [
      name || existing.name,
      description !== undefined ? description : existing.description,
      id
    ]);

    const category = queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id — Products become uncategorized (ON DELETE SET NULL)
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const affected = queryOne('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]);
    runSql('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ message: 'Category deleted successfully', productsSetToUncategorized: affected.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
