import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/transfers — List all transfers
router.get('/', (req, res) => {
  try {
    const transfers = queryAll(
      `SELECT t.*,
        sw.name as source_warehouse_name,
        dw.name as dest_warehouse_name,
        COUNT(ti.id) as item_count,
        COALESCE(SUM(ti.quantity), 0) as total_units
       FROM transfers t
       JOIN warehouses sw ON t.source_warehouse_id = sw.id
       JOIN warehouses dw ON t.dest_warehouse_id = dw.id
       LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
       GROUP BY t.id ORDER BY t.created_at DESC`
    );
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transfers/:id — Get transfer with items
router.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const transfer = queryOne(
      `SELECT t.*, sw.name as source_warehouse_name, dw.name as dest_warehouse_name
       FROM transfers t
       JOIN warehouses sw ON t.source_warehouse_id = sw.id
       JOIN warehouses dw ON t.dest_warehouse_id = dw.id
       WHERE t.id = ?`,
      [id]
    );
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    const items = queryAll(
      `SELECT ti.*, p.name as product_name, p.sku, p.unit_of_measure
       FROM transfer_items ti
       JOIN products p ON ti.product_id = p.id
       WHERE ti.transfer_id = ?`,
      [id]
    );

    res.json({ ...transfer, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers — Create transfer
router.post('/', (req, res) => {
  try {
    const { source_warehouse_id, dest_warehouse_id, notes } = req.body;
    if (!source_warehouse_id || !dest_warehouse_id) {
      return res.status(400).json({ error: 'Source and destination warehouses are required.' });
    }
    if (Number(source_warehouse_id) === Number(dest_warehouse_id)) {
      return res.status(400).json({ error: 'Source and destination cannot be the same.' });
    }

    const srcWh = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(source_warehouse_id)]);
    if (!srcWh) return res.status(404).json({ error: 'Source warehouse not found' });

    const destWh = queryOne('SELECT * FROM warehouses WHERE id = ?', [Number(dest_warehouse_id)]);
    if (!destWh) return res.status(404).json({ error: 'Destination warehouse not found' });

    const result = runSql(
      'INSERT INTO transfers (source_warehouse_id, dest_warehouse_id, notes) VALUES (?, ?, ?)',
      [Number(source_warehouse_id), Number(dest_warehouse_id), notes || '']
    );

    const transfer = queryOne(
      `SELECT t.*, sw.name as source_warehouse_name, dw.name as dest_warehouse_name
       FROM transfers t
       JOIN warehouses sw ON t.source_warehouse_id = sw.id
       JOIN warehouses dw ON t.dest_warehouse_id = dw.id
       WHERE t.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(transfer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/:id/items — Add item to transfer
router.post('/:id/items', (req, res) => {
  try {
    const transferId = Number(req.params.id);
    const transfer = queryOne('SELECT * FROM transfers WHERE id = ?', [transferId]);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Validated') return res.status(400).json({ error: 'Cannot modify a validated transfer.' });

    const { product_id, quantity } = req.body;
    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'product_id and quantity (>0) are required.' });
    }

    const result = runSql(
      'INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)',
      [transferId, Number(product_id), Number(quantity)]
    );

    const item = queryOne(
      `SELECT ti.*, p.name as product_name, p.sku
       FROM transfer_items ti JOIN products p ON ti.product_id = p.id
       WHERE ti.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/:id/validate — Validate: move stock between warehouses
router.post('/:id/validate', (req, res) => {
  try {
    const id = Number(req.params.id);
    const transfer = queryOne('SELECT * FROM transfers WHERE id = ?', [id]);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Validated') return res.status(400).json({ error: 'Transfer already validated.' });

    const items = queryAll('SELECT * FROM transfer_items WHERE transfer_id = ?', [id]);
    if (items.length === 0) return res.status(400).json({ error: 'Cannot validate an empty transfer.' });

    // Pre-check: sufficient stock at source
    for (const item of items) {
      const stock = queryOne(
        'SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, transfer.source_warehouse_id]
      );
      const available = stock ? stock.quantity : 0;
      if (available < item.quantity) {
        const product = queryOne('SELECT name, sku FROM products WHERE id = ?', [item.product_id]);
        return res.status(400).json({
          error: `Insufficient stock at source: "${product.name}" (${product.sku}) — available: ${available}, requested: ${item.quantity}`
        });
      }
    }

    // Move stock: decrease source, increase destination
    for (const item of items) {
      // Decrease source
      runSql(
        'UPDATE warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
        [item.quantity, item.product_id, transfer.source_warehouse_id]
      );

      // Increase destination (upsert)
      const destStock = queryOne(
        'SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, transfer.dest_warehouse_id]
      );
      if (destStock) {
        runSql(
          'UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
          [item.quantity, item.product_id, transfer.dest_warehouse_id]
        );
      } else {
        runSql(
          'INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [item.product_id, transfer.dest_warehouse_id, item.quantity]
        );
      }
    }

    // Mark validated
    runSql('UPDATE transfers SET status = ?, validated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['Validated', id]);

    const updated = queryOne('SELECT * FROM transfers WHERE id = ?', [id]);
    res.json({ message: 'Transfer validated. Stock moved.', transfer: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transfers/:id
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const transfer = queryOne('SELECT * FROM transfers WHERE id = ?', [id]);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'Validated') return res.status(400).json({ error: 'Cannot delete a validated transfer.' });

    runSql('DELETE FROM transfers WHERE id = ?', [id]);
    res.json({ message: 'Transfer deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
