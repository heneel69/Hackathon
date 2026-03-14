import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/adjustments — List all stock adjustments
router.get('/', (req, res) => {
  try {
    const adjustments = queryAll(
      `SELECT sa.*, p.name as product_name, p.sku, p.unit_of_measure,
              w.name as warehouse_name,
              (sa.new_quantity - sa.old_quantity) as diff
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       JOIN warehouses w ON sa.warehouse_id = w.id
       ORDER BY sa.created_at DESC`
    );
    res.json(adjustments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/adjustments — Create adjustment (auto-updates stock)
router.post('/', (req, res) => {
  try {
    const { product_id, warehouse_id, new_quantity, reason } = req.body;

    if (product_id == null || warehouse_id == null || new_quantity == null) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and new_quantity are required.' });
    }

    if (Number(new_quantity) < 0) {
      return res.status(400).json({ error: 'new_quantity cannot be negative.' });
    }

    const product = queryOne('SELECT * FROM products WHERE id = ?', [Number(product_id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(warehouse_id)]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    // Get current stock at this location
    const stock = queryOne(
      'SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [Number(product_id), Number(warehouse_id)]
    );
    const oldQty = stock ? stock.quantity : 0;
    const newQty = Number(new_quantity);
    const diff = newQty - oldQty;

    // Record the adjustment
    const result = runSql(
      'INSERT INTO stock_adjustments (product_id, warehouse_id, old_quantity, new_quantity, reason) VALUES (?, ?, ?, ?, ?)',
      [Number(product_id), Number(warehouse_id), oldQty, newQty, reason || '']
    );

    // Update warehouse_stock
    if (stock) {
      runSql(
        'UPDATE warehouse_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
        [newQty, Number(product_id), Number(warehouse_id)]
      );
    } else {
      runSql(
        'INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
        [Number(product_id), Number(warehouse_id), newQty]
      );
    }

    // Update product's global initial_stock
    runSql('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?',
      [diff, Number(product_id)]);

    const adjustment = queryOne(
      `SELECT sa.*, p.name as product_name, p.sku, w.name as warehouse_name,
              (sa.new_quantity - sa.old_quantity) as diff
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       JOIN warehouses w ON sa.warehouse_id = w.id
       WHERE sa.id = ?`,
      [result.lastInsertRowid]
    );

    res.status(201).json({
      message: `Stock adjusted by ${diff >= 0 ? '+' : ''}${diff} units.`,
      adjustment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
