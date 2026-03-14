import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/products — List all products (with optional search)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let products;
    if (search) {
      products = queryAll(
        `SELECT p.*, c.name as category_name
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.name LIKE ? OR p.sku LIKE ?
         ORDER BY p.created_at DESC`,
        [`%${search}%`, `%${search}%`]
      );
    } else {
      products = queryAll(
        `SELECT p.*, c.name as category_name
         FROM products p LEFT JOIN categories c ON p.category_id = c.id
         ORDER BY p.created_at DESC`
      );
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id — Get single product
router.get('/:id', (req, res) => {
  try {
    const product = queryOne(
      `SELECT p.*, c.name as category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [Number(req.params.id)]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — Create product
router.post('/', (req, res) => {
  try {
    const { name, sku, category_id, unit_of_measure, initial_stock, min_stock_threshold } = req.body;

    if (!name || !sku || !unit_of_measure) {
      return res.status(400).json({ error: 'Name, SKU, and Unit of Measure are required.' });
    }

    // Check SKU uniqueness
    const existing = queryOne('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing) {
      return res.status(409).json({ error: 'A product with this SKU already exists.' });
    }

    const stock = initial_stock != null && initial_stock !== '' ? Number(initial_stock) : 0;
    const result = runSql(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, initial_stock, min_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, sku, category_id || null, unit_of_measure, stock, min_stock_threshold || null]
    );

    const product = queryOne('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id — Update product
router.put('/:id', (req, res) => {
  try {
    const { name, sku, category_id, unit_of_measure, initial_stock, min_stock_threshold } = req.body;
    const id = Number(req.params.id);
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // Check SKU uniqueness if sku is changing
    if (sku && sku !== existing.sku) {
      const skuCheck = queryOne('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
      if (skuCheck) return res.status(409).json({ error: 'A product with this SKU already exists.' });
    }

    runSql(
      `UPDATE products
       SET name = ?, sku = ?, category_id = ?, unit_of_measure = ?, initial_stock = ?, min_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || existing.name,
        sku || existing.sku,
        category_id !== undefined ? (category_id || null) : existing.category_id,
        unit_of_measure || existing.unit_of_measure,
        initial_stock != null ? Number(initial_stock) : existing.initial_stock,
        min_stock_threshold != null ? Number(min_stock_threshold) : existing.min_stock_threshold,
        id
      ]
    );

    const product = queryOne(
      `SELECT p.*, c.name as category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — Delete product
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    runSql('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/stock — Stock breakdown per warehouse
router.get('/:id/stock', (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const stock = queryAll(
      `SELECT ws.*, w.name as warehouse_name, w.address as warehouse_address
       FROM warehouse_stock ws
       JOIN warehouses w ON ws.warehouse_id = w.id
       WHERE ws.product_id = ?`,
      [id]
    );

    const totalStock = stock.reduce((sum, s) => sum + s.quantity, 0);
    res.json({ product, stock, totalStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
