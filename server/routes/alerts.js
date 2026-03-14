import { Router } from 'express';
import { queryAll } from '../db.js';

const router = Router();

// GET /api/alerts — Low-stock alerts
router.get('/', (req, res) => {
  try {
    const alerts = queryAll(
      `SELECT
        p.id, p.name, p.sku, p.unit_of_measure, p.min_stock_threshold, p.initial_stock,
        c.name as category_name,
        COALESCE(
          (SELECT SUM(ws.quantity) FROM warehouse_stock ws WHERE ws.product_id = p.id),
          p.initial_stock
        ) as current_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.min_stock_threshold IS NOT NULL
       ORDER BY p.name ASC`
    );

    const activeAlerts = alerts.filter(a => a.current_stock < a.min_stock_threshold);
    const resolvedAlerts = alerts.filter(a => a.current_stock >= a.min_stock_threshold);

    res.json({ activeAlerts, resolvedAlerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
