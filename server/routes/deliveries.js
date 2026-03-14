import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/deliveries — List all delivery orders
router.get('/', (req, res) => {
  try {
    const deliveries = queryAll(
      `SELECT d.*, COUNT(di.id) as item_count,
        COALESCE(SUM(di.quantity), 0) as total_units
       FROM delivery_orders d
       LEFT JOIN delivery_items di ON d.id = di.delivery_id
       GROUP BY d.id ORDER BY d.created_at DESC`
    );
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deliveries/:id — Get delivery with items
router.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery order not found' });

    const items = queryAll(
      `SELECT di.*, p.name as product_name, p.sku, p.unit_of_measure,
              w.name as warehouse_name
       FROM delivery_items di
       JOIN products p ON di.product_id = p.id
       JOIN warehouses w ON di.warehouse_id = w.id
       WHERE di.delivery_id = ?`,
      [id]
    );

    res.json({ ...delivery, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deliveries — Create delivery order (Draft)
router.post('/', (req, res) => {
  try {
    const { customer_name, notes } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required.' });

    const result = runSql(
      'INSERT INTO delivery_orders (customer_name, notes) VALUES (?, ?)',
      [customer_name, notes || '']
    );
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deliveries/:id/items — Add item to delivery
router.post('/:id/items', (req, res) => {
  try {
    const deliveryId = Number(req.params.id);
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [deliveryId]);
    if (!delivery) return res.status(404).json({ error: 'Delivery order not found' });
    if (delivery.status === 'Validated') return res.status(400).json({ error: 'Cannot modify a validated delivery.' });

    const { product_id, warehouse_id, quantity } = req.body;
    if (!product_id || !warehouse_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and quantity (>0) are required.' });
    }

    const result = runSql(
      'INSERT INTO delivery_items (delivery_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
      [deliveryId, Number(product_id), Number(warehouse_id), Number(quantity)]
    );

    const item = queryOne(
      `SELECT di.*, p.name as product_name, p.sku, w.name as warehouse_name
       FROM delivery_items di
       JOIN products p ON di.product_id = p.id
       JOIN warehouses w ON di.warehouse_id = w.id
       WHERE di.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deliveries/:id/status — Transition status: Draft → Picking → Packing
router.put('/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery order not found' });

    const validTransitions = {
      'Draft': 'Picking',
      'Picking': 'Packing',
    };

    if (validTransitions[delivery.status] !== status) {
      return res.status(400).json({
        error: `Invalid transition: ${delivery.status} → ${status}. Expected: ${delivery.status} → ${validTransitions[delivery.status] || '(no transition available, use /validate)'}`
      });
    }

    runSql('UPDATE delivery_orders SET status = ? WHERE id = ?', [status, id]);
    const updated = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deliveries/:id/validate — Validate: decrease stock (blocks if insufficient)
router.post('/:id/validate', (req, res) => {
  try {
    const id = Number(req.params.id);
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery order not found' });
    if (delivery.status === 'Validated') return res.status(400).json({ error: 'Delivery already validated.' });

    const items = queryAll('SELECT * FROM delivery_items WHERE delivery_id = ?', [id]);
    if (items.length === 0) return res.status(400).json({ error: 'Cannot validate an empty delivery.' });

    // Pre-check: ensure sufficient stock for ALL items before modifying anything
    for (const item of items) {
      const stock = queryOne(
        'SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, item.warehouse_id]
      );

      const available = stock ? stock.quantity : 0;
      if (available < item.quantity) {
        const product = queryOne('SELECT name, sku FROM products WHERE id = ?', [item.product_id]);
        const warehouse = queryOne('SELECT name FROM warehouses WHERE id = ?', [item.warehouse_id]);
        return res.status(400).json({
          error: `Insufficient Stock: "${product.name}" (${product.sku}) in ${warehouse.name} — available: ${available}, requested: ${item.quantity}`
        });
      }
    }

    // Decrease stock for each item
    for (const item of items) {
      runSql(
        'UPDATE warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
        [item.quantity, item.product_id, item.warehouse_id]
      );
      runSql('UPDATE products SET initial_stock = initial_stock - ? WHERE id = ?',
        [item.quantity, item.product_id]);
    }

    // Mark as validated
    runSql('UPDATE delivery_orders SET status = ?, validated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['Validated', id]);

    const updated = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    res.json({ message: 'Delivery validated. Stock decreased.', delivery: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const delivery = queryOne('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!delivery) return res.status(404).json({ error: 'Delivery order not found' });
    if (delivery.status === 'Validated') return res.status(400).json({ error: 'Cannot delete a validated delivery.' });

    runSql('DELETE FROM delivery_orders WHERE id = ?', [id]);
    res.json({ message: 'Delivery order deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
