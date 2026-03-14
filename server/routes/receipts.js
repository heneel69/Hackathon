import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/receipts — List all receipts with item count
router.get('/', (req, res) => {
  try {
    const receipts = queryAll(
      `SELECT r.*, COUNT(ri.id) as item_count,
        COALESCE(SUM(ri.quantity), 0) as total_units
       FROM receipts r
       LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
       GROUP BY r.id ORDER BY r.created_at DESC`
    );
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipts/:id — Get receipt with items
router.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const receipt = queryOne('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    const items = queryAll(
      `SELECT ri.*, p.name as product_name, p.sku, p.unit_of_measure,
              w.name as warehouse_name
       FROM receipt_items ri
       JOIN products p ON ri.product_id = p.id
       JOIN warehouses w ON ri.warehouse_id = w.id
       WHERE ri.receipt_id = ?`,
      [id]
    );

    res.json({ ...receipt, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/receipts — Create new receipt (Draft)
router.post('/', (req, res) => {
  try {
    const { supplier_name, notes } = req.body;
    if (!supplier_name) return res.status(400).json({ error: 'Supplier name is required.' });

    const result = runSql(
      'INSERT INTO receipts (supplier_name, notes) VALUES (?, ?)',
      [supplier_name, notes || '']
    );
    const receipt = queryOne('SELECT * FROM receipts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/receipts/:id/items — Add item to receipt
router.post('/:id/items', (req, res) => {
  try {
    const receiptId = Number(req.params.id);
    const receipt = queryOne('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status === 'Validated') return res.status(400).json({ error: 'Cannot modify a validated receipt.' });

    const { product_id, warehouse_id, quantity } = req.body;
    if (!product_id || !warehouse_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and quantity (>0) are required.' });
    }

    const product = queryOne('SELECT * FROM products WHERE id = ?', [Number(product_id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const warehouse = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(warehouse_id)]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    const result = runSql(
      'INSERT INTO receipt_items (receipt_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
      [receiptId, Number(product_id), Number(warehouse_id), Number(quantity)]
    );

    const item = queryOne(
      `SELECT ri.*, p.name as product_name, p.sku, w.name as warehouse_name
       FROM receipt_items ri
       JOIN products p ON ri.product_id = p.id
       JOIN warehouses w ON ri.warehouse_id = w.id
       WHERE ri.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/receipts/:id/validate — Validate receipt: increase stock
router.post('/:id/validate', (req, res) => {
  try {
    const id = Number(req.params.id);
    const receipt = queryOne('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status === 'Validated') return res.status(400).json({ error: 'Receipt already validated.' });

    const items = queryAll('SELECT * FROM receipt_items WHERE receipt_id = ?', [id]);
    if (items.length === 0) return res.status(400).json({ error: 'Cannot validate an empty receipt.' });

    // Increase warehouse_stock for each item
    for (const item of items) {
      const existing = queryOne(
        'SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, item.warehouse_id]
      );

      if (existing) {
        runSql(
          'UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
          [item.quantity, item.product_id, item.warehouse_id]
        );
      } else {
        runSql(
          'INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [item.product_id, item.warehouse_id, item.quantity]
        );
      }

      // Also update product initial_stock for global tracking
      runSql('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?',
        [item.quantity, item.product_id]);
    }

    // Mark as validated
    runSql('UPDATE receipts SET status = ?, validated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['Validated', id]);

    const updated = queryOne('SELECT * FROM receipts WHERE id = ?', [id]);
    res.json({ message: 'Receipt validated. Stock increased.', receipt: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/receipts/:id — Delete draft receipt
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const receipt = queryOne('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status === 'Validated') return res.status(400).json({ error: 'Cannot delete a validated receipt.' });

    runSql('DELETE FROM receipts WHERE id = ?', [id]);
    res.json({ message: 'Receipt deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
