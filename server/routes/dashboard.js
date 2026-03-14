import { Router } from 'express';
import { queryOne, queryAll } from '../db.js';

const router = Router();

// GET /api/dashboard/kpis
router.get('/kpis', (req, res) => {
  try {
    // Total Products in Stock: Sum of all stock across all warehouses
    const totalStockRes = queryOne(`SELECT SUM(quantity) as total_qty FROM warehouse_stock`);
    const totalProductsInStock = totalStockRes && totalStockRes.total_qty ? parseInt(totalStockRes.total_qty, 10) : 0;

    // Low Stock / Out of Stock Items
    const lowStockRes = queryOne(`
      SELECT COUNT(*) as low_stock_count FROM products p 
      LEFT JOIN (SELECT product_id, SUM(quantity) as total_qty FROM warehouse_stock GROUP BY product_id) ws 
      ON p.id = ws.product_id 
      WHERE coalesce(ws.total_qty, 0) <= p.min_stock_threshold
    `);
    const lowStockItems = lowStockRes ? parseInt(lowStockRes.low_stock_count, 10) : 0;

    // Pending Receipts
    const pendingReceiptsRes = queryOne(`SELECT COUNT(*) as count FROM receipts WHERE status = 'Draft'`);
    const pendingReceipts = pendingReceiptsRes ? parseInt(pendingReceiptsRes.count, 10) : 0;

    // Pending Deliveries
    const pendingDeliveriesRes = queryOne(`SELECT COUNT(*) as count FROM delivery_orders WHERE status != 'Validated'`);
    const pendingDeliveries = pendingDeliveriesRes ? parseInt(pendingDeliveriesRes.count, 10) : 0;

    // Internal Transfers Scheduled
    const transfersScheduledRes = queryOne(`SELECT COUNT(*) as count FROM transfers WHERE status = 'Draft'`);
    const internalTransfersScheduled = transfersScheduledRes ? parseInt(transfersScheduledRes.count, 10) : 0;

    res.json({
      totalProductsInStock,
      lowStockItems,
      pendingReceipts,
      pendingDeliveries,
      internalTransfersScheduled
    });
  } catch (error) {
    console.error('Error fetching dashboard KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// GET /api/dashboard/operations
// Optional Query Params: type, status, warehouse_id, category_id
router.get('/operations', (req, res) => {
  try {
    const { type, status, warehouse_id, category_id } = req.query;

    const queryStr = `
      SELECT 'Receipts' as type, r.id as operation_id, r.status, r.created_at, 
             ri.warehouse_id, p.category_id, c.name as category_name, w.name as warehouse_name, p.name as product_name, ri.quantity
      FROM receipts r
      JOIN receipt_items ri ON r.id = ri.receipt_id
      JOIN products p ON ri.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON ri.warehouse_id = w.id

      UNION ALL

      SELECT 'Deliveries' as type, d.id as operation_id, d.status, d.created_at, 
             di.warehouse_id, p.category_id, c.name as category_name, w.name as warehouse_name, p.name as product_name, di.quantity
      FROM delivery_orders d
      JOIN delivery_items di ON d.id = di.delivery_id
      JOIN products p ON di.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON di.warehouse_id = w.id

      UNION ALL

      SELECT 'Transfers' as type, t.id as operation_id, t.status, t.created_at, 
             t.source_warehouse_id as warehouse_id, p.category_id, c.name as category_name, w.name as warehouse_name, p.name as product_name, ti.quantity
      FROM transfers t
      JOIN transfer_items ti ON t.id = ti.transfer_id
      JOIN products p ON ti.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON t.source_warehouse_id = w.id

      UNION ALL

      SELECT 'Adjustments' as type, a.id as operation_id, 'Done' as status, a.created_at, 
             a.warehouse_id, p.category_id, c.name as category_name, w.name as warehouse_name, p.name as product_name, (a.new_quantity - a.old_quantity) as quantity
      FROM stock_adjustments a
      JOIN products p ON a.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN warehouses w ON a.warehouse_id = w.id
    `;

    // Wrap in a CTE to apply dynamic filters
    let filterQuery = `WITH operations AS (${queryStr}) SELECT * FROM operations WHERE 1=1`;
    const params = [];

    if (type) {
      filterQuery += ` AND type = ?`;
      params.push(type);
    }
    if (status) {
      filterQuery += ` AND status = ?`;
      params.push(status);
    }
    if (warehouse_id) {
      filterQuery += ` AND warehouse_id = ?`;
      params.push(warehouse_id);
    }
    if (category_id) {
      filterQuery += ` AND category_id = ?`;
      params.push(category_id);
    }

    filterQuery += ` ORDER BY created_at DESC LIMIT 100`;

    const operations = queryAll(filterQuery, params);
    
    // Also fetch current stock levels per product & warehouse for the "active operations and stock levels" requirement
    let stockQuery = `
      SELECT p.name as product_name, p.sku, c.name as category_name, w.name as warehouse_name, ws.quantity
      FROM warehouse_stock ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN warehouses w ON ws.warehouse_id = w.id
      WHERE 1=1
    `;
    const stockParams = [];
    if (warehouse_id) {
      stockQuery += ` AND ws.warehouse_id = ?`;
      stockParams.push(warehouse_id);
    }
    if (category_id) {
      stockQuery += ` AND p.category_id = ?`;
      stockParams.push(category_id);
    }
    stockQuery += ` ORDER BY p.name ASC`;
    const stockLevels = queryAll(stockQuery, stockParams);

    res.json({ operations, stockLevels });

  } catch (error) {
    console.error('Error fetching dashboard operations:', error);
    res.status(500).json({ error: 'Failed to fetch operations data' });
  }
});

export default router;
