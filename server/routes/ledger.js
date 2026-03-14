import { Router } from 'express';
import { queryAll } from '../db.js';

const router = Router();

// GET /api/ledger — List all stock ledger history with readable joins
router.get('/', (req, res) => {
  try {
    const { operation_type, product_id, start_date, end_date } = req.query;

    let sql = `
      SELECT sl.*,
             p.name as product_name,
             p.sku,
             p.unit_of_measure,
             u.name as user_name,
             sw.name as source_warehouse_name,
             dw.name as dest_warehouse_name
      FROM stock_ledger sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN users u ON sl.user_id = u.id
      LEFT JOIN warehouses sw ON sl.source_warehouse_id = sw.id
      LEFT JOIN warehouses dw ON sl.dest_warehouse_id = dw.id
      WHERE 1=1
    `;
    const params = [];

    if (operation_type) {
      sql += ' AND sl.operation_type = ?';
      params.push(operation_type);
    }
    if (product_id) {
      sql += ' AND sl.product_id = ?';
      params.push(Number(product_id));
    }
    if (start_date) {
      sql += ' AND sl.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      // Append time to end_date to include the whole day
      sql += ' AND sl.created_at <= ?';
      params.push(`${end_date} 23:59:59`);
    }

    sql += ' ORDER BY sl.created_at DESC';

    const history = queryAll(sql, params);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
