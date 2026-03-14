import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/warehouses
router.get('/', (req, res) => {
  try {
    const warehouses = queryAll(
      `SELECT w.*,
        COALESCE(SUM(ws.quantity), 0) as total_units,
        COUNT(DISTINCT CASE WHEN ws.quantity > 0 THEN ws.product_id END) as product_count
       FROM warehouses w
       LEFT JOIN warehouse_stock ws ON w.id = ws.warehouse_id
       GROUP BY w.id ORDER BY w.created_at DESC`
    );
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/warehouses/:id
router.get('/:id', (req, res) => {
  try {
    if (req.params.id === 'stock') return; // skip, handled by POST /stock
    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(req.params.id)]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
    res.json(warehouse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/warehouses
router.post('/', (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Warehouse name is required.' });

    const existing = queryOne('SELECT id FROM warehouses WHERE name = ?', [name]);
    if (existing) return res.status(409).json({ error: 'A warehouse with this name already exists.' });

    const result = runSql('INSERT INTO warehouses (name, address) VALUES (?, ?)', [name, address || '']);
    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(warehouse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/warehouses/:id
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, is_active } = req.body;
    const existing = queryOne('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Warehouse not found' });

    runSql('UPDATE warehouses SET name = ?, address = ?, is_active = ? WHERE id = ?', [
      name || existing.name,
      address !== undefined ? address : existing.address,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    ]);

    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [id]);
    res.json(warehouse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/warehouses/:id — Soft delete (deactivate)
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Warehouse not found' });

    runSql('UPDATE warehouses SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Warehouse deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/warehouses/:id/stock
router.get('/:id/stock', (req, res) => {
  try {
    const id = Number(req.params.id);
    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    const stock = queryAll(
      `SELECT ws.*, p.name as product_name, p.sku, p.unit_of_measure
       FROM warehouse_stock ws JOIN products p ON ws.product_id = p.id
       WHERE ws.warehouse_id = ? ORDER BY p.name ASC`,
      [id]
    );

    res.json({ warehouse, stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/warehouses/stock — Add/update stock at a warehouse
router.post('/stock', (req, res) => {
  try {
    const { product_id, warehouse_id, quantity } = req.body;
    if (!product_id || !warehouse_id || quantity == null) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and quantity are required.' });
    }

    const product = queryOne('SELECT * FROM products WHERE id = ?', [Number(product_id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(warehouse_id)]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    // Upsert
    const existingStock = queryOne(
      'SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [Number(product_id), Number(warehouse_id)]
    );

    if (existingStock) {
      runSql('UPDATE warehouse_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
        [Number(quantity), Number(product_id), Number(warehouse_id)]);
    } else {
      runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
        [Number(product_id), Number(warehouse_id), Number(quantity)]);
    }

    const stockEntry = queryOne(
      `SELECT ws.*, w.name as warehouse_name, p.name as product_name
       FROM warehouse_stock ws
       JOIN warehouses w ON ws.warehouse_id = w.id
       JOIN products p ON ws.product_id = p.id
       WHERE ws.product_id = ? AND ws.warehouse_id = ?`,
      [Number(product_id), Number(warehouse_id)]
    );

    res.status(200).json(stockEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
