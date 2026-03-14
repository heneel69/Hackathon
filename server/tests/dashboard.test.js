import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { createDb } from '../db.js';
import dashboardRouter from '../routes/dashboard.js';
import receiptsRouter from '../routes/receipts.js';
import deliveriesRouter from '../routes/deliveries.js';
import transfersRouter from '../routes/transfers.js';
import adjustmentsRouter from '../routes/adjustments.js';

describe('Module 2,3,4: Dashboard Integration', () => {
    let app, db;
    let category1, category2, warehouse1, warehouse2;

    before(async () => {
        app = express();
        app.use(express.json());
        
        // Let db.js handle test logic natively
        db = await createDb(':memory:');
        
        app.use('/api/dashboard', dashboardRouter);
        app.use('/api/receipts', receiptsRouter);
        app.use('/api/deliveries', deliveriesRouter);
        app.use('/api/transfers', transfersRouter);
        app.use('/api/adjustments', adjustmentsRouter);

        // CLEANUP PREVIOUS MOCK DATA injected by prior parallel tests using the singleton
        db.exec("DELETE FROM warehouse_stock");
        db.exec("DELETE FROM receipt_items");
        db.exec("DELETE FROM receipts");
        db.exec("DELETE FROM delivery_items");
        db.exec("DELETE FROM delivery_orders");
        db.exec("DELETE FROM transfer_items");
        db.exec("DELETE FROM transfers");
        db.exec("DELETE FROM stock_adjustments");
        db.exec("DELETE FROM products");
        db.exec("DELETE FROM warehouses");
        db.exec("DELETE FROM categories");

        // Setup base categories and warehouses
        db.exec("INSERT INTO categories (name) VALUES ('Raw Materials D'), ('Electronics D')");
        category1 = db.prepare("SELECT id FROM categories WHERE name = 'Raw Materials D'").get().id;
        category2 = db.prepare("SELECT id FROM categories WHERE name = 'Electronics D'").get().id;

        db.exec("INSERT INTO warehouses (name) VALUES ('Warehouse 1 D'), ('Warehouse 2 D')");
        warehouse1 = db.prepare("SELECT id FROM warehouses WHERE name = 'Warehouse 1 D'").get().id;
        warehouse2 = db.prepare("SELECT id FROM warehouses WHERE name = 'Warehouse 2 D'").get().id;

        // Data Aggregation Test Setup
        db.exec(`INSERT INTO products (name, sku, category_id, unit_of_measure, min_stock_threshold) VALUES 
            ('Bulk Item', 'B-1D', ${category1}, 'pcs', 10),
            ('Tech Item', 'T-1D', ${category2}, 'pcs', 10)`);
        
        const bulkId = db.prepare("SELECT id FROM products WHERE sku = 'B-1D'").get().id;
        const techId = db.prepare("SELECT id FROM products WHERE sku = 'T-1D'").get().id;

        db.exec(`INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES 
            (${bulkId}, ${warehouse1}, 400),
            (${techId}, ${warehouse1}, 100)`);

        // 2. Inject 5 items below reorder thresholds
        db.exec(`INSERT INTO products (name, sku, category_id, unit_of_measure, min_stock_threshold) VALUES 
            ('Low 1', 'L-1D', ${category1}, 'pcs', 5),
            ('Low 2', 'L-2D', ${category1}, 'pcs', 5),
            ('Low 3', 'L-3D', ${category1}, 'pcs', 5),
            ('Low 4', 'L-4D', ${category1}, 'pcs', 5),
            ('Low 5', 'L-5D', ${category1}, 'pcs', 5)`);

        // 3. Inject 3 unvalidated receipts
        db.exec(`INSERT INTO receipts (supplier_name, status) VALUES 
            ('Supp A', 'Draft'),
            ('Supp B', 'Draft'),
            ('Supp C', 'Draft')`);
        
        const r1Id = db.prepare("SELECT id FROM receipts WHERE supplier_name = 'Supp A'").get().id;
        
        db.exec(`INSERT INTO receipt_items (receipt_id, product_id, warehouse_id, quantity) VALUES (${r1Id}, ${bulkId}, ${warehouse1}, 10)`);
    });

    after(() => {
        db.close();
    });

    it('Data Aggregation Test: should reflect 500 stock, 5 low stock, 3 pending receipts', async () => {
        const res = await request(app).get('/api/dashboard/kpis');
        assert.strictEqual(res.status, 200);
        
        assert.strictEqual(res.body.totalProductsInStock, 500, 'Total Products in Stock should be 500');
        assert.strictEqual(res.body.lowStockItems, 5, 'Low Stock Items should be 5');
        assert.strictEqual(res.body.pendingReceipts, 3, 'Pending Receipts should be 3');
        assert.strictEqual(res.body.pendingDeliveries, 0, 'Pending Deliveries should be 0');
    });

    it('State Verification Test: Pending Deliveries KPI increases on Draft, decreases on Validated', async () => {
        const res1 = await request(app).post('/api/deliveries').send({ customer_name: 'Test Cust dboard' });
        const deliveryId = res1.body.id;

        const bulkId = db.prepare("SELECT id FROM products WHERE sku = 'B-1D'").get().id;

        await request(app).post(`/api/deliveries/${deliveryId}/items`).send({
            product_id: bulkId, warehouse_id: warehouse1, quantity: 10
        });

        const kpiAfterDraft = await request(app).get('/api/dashboard/kpis');
        assert.strictEqual(kpiAfterDraft.body.pendingDeliveries, 1);

        await request(app).post(`/api/deliveries/${deliveryId}/validate`);

        const kpiAfterValidated = await request(app).get('/api/dashboard/kpis');
        assert.strictEqual(kpiAfterValidated.body.pendingDeliveries, 0);
    });

    it('Document Filter Test: Apply Receipts filter', async () => {
        const res = await request(app).get('/api/dashboard/operations?type=Receipts');
        assert.strictEqual(res.status, 200);
        
        res.body.operations.forEach(op => {
            assert.strictEqual(op.type, 'Receipts');
        });
        assert.ok(res.body.operations.length > 0);
    });

    it('Status Filter Test: Apply Done/Validated status filter', async () => {
        const bulkId = db.prepare("SELECT id FROM products WHERE sku = 'B-1D'").get().id;
        db.exec(`INSERT INTO stock_adjustments (product_id, warehouse_id, old_quantity, new_quantity) VALUES (${bulkId}, ${warehouse2}, 0, 5)`);

        const res = await request(app).get('/api/dashboard/operations?status=Done');
        assert.strictEqual(res.status, 200);
        
        res.body.operations.forEach(op => {
            assert.strictEqual(op.status, 'Done');
        });
        assert.ok(res.body.operations.length > 0);
    });

    it('Location & Category Test: Apply Warehouse 1 AND Raw Materials filter', async () => {
        const res = await request(app).get(`/api/dashboard/operations?warehouse_id=${warehouse1}&category_id=${category1}`);
        assert.strictEqual(res.status, 200);
        
        res.body.operations.forEach(op => {
            assert.strictEqual(op.category_name, 'Raw Materials D');
            assert.strictEqual(op.warehouse_name, 'Warehouse 1 D');
        });
    });
});
