import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { createDb } from '../db.js';
import receiptsRouter from '../routes/receipts.js';
import deliveriesRouter from '../routes/deliveries.js';
import transfersRouter from '../routes/transfers.js';
import adjustmentsRouter from '../routes/adjustments.js';

describe('Module 4: Ledger Integration Hooks', () => {
    let app, db, server;
    let pId, wId1, wId2, uId;

    before(async () => {
        app = express();
        app.use(express.json());
        // Mock user middleware for user_id capture
        app.use((req, res, next) => { req.user = { id: 1 }; next(); });
        
        db = await createDb(':memory:');
        
        const timestamp = Date.now();
        // Setup base data
        db.exec(`INSERT INTO categories (name) VALUES ('Ledger Cat ${timestamp}')`);
        const catId = db.prepare(`SELECT id FROM categories WHERE name = 'Ledger Cat ${timestamp}'`).get().id;
        
        db.exec(`INSERT INTO products (name, sku, category_id, unit_of_measure, initial_stock) VALUES ('Test Item', 'TI-1-${timestamp}', ${catId}, 'pcs', 100)`);
        pId = db.prepare(`SELECT id FROM products WHERE sku = 'TI-1-${timestamp}'`).get().id;
        
        db.exec(`INSERT INTO warehouses (name) VALUES ('WH1-${timestamp}'), ('WH2-${timestamp}')`);
        wId1 = db.prepare(`SELECT id FROM warehouses WHERE name = 'WH1-${timestamp}'`).get().id;
        wId2 = db.prepare(`SELECT id FROM warehouses WHERE name = 'WH2-${timestamp}'`).get().id;
        
        db.exec(`INSERT INTO users (name, email, password_hash, role) VALUES ('Tester', 'test${timestamp}@example.com', 'h', 'Warehouse Staff')`);
        
        uId = db.prepare(`SELECT id FROM users WHERE email = 'test${timestamp}@example.com'`).get().id;

        // Initialize warehouse stock
        db.exec(`INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (${pId}, ${wId1}, 50)`);

        app.use('/api/receipts', receiptsRouter);
        app.use('/api/deliveries', deliveriesRouter);
        app.use('/api/transfers', transfersRouter);
        app.use('/api/adjustments', adjustmentsRouter);
    });

    after(() => {
        db.close();
    });

    it('should create a ledger entry on Receipt validation', async () => {
        // Create receipt & item
        const result1 = await request(app).post('/api/receipts').send({ supplier_name: 'Supp' });
        const rId = result1.body.id;
        await request(app).post(`/api/receipts/${rId}/items`).send({ product_id: pId, warehouse_id: wId1, quantity: 15 });
        
        // Count ledger before
        const rBefore = db.prepare("SELECT COUNT(*) as c FROM stock_ledger").get().c;
        
        // Validate
        await request(app).post(`/api/receipts/${rId}/validate`);
        
        // Verify ledger
        const entries = db.prepare("SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 1").get();
        assert.ok(entries);
        assert.strictEqual(entries.operation_type, 'Receipt');
        assert.strictEqual(entries.quantity_change, 15);
        assert.strictEqual(entries.dest_warehouse_id, wId1);
        assert.strictEqual(entries.product_id, pId);
    });

    it('should create a ledger entry on Delivery validation', async () => {
        // Create delivery & item
        const result1 = await request(app).post('/api/deliveries').send({ customer_name: 'Cust' });
        const dId = result1.body.id;
        await request(app).post(`/api/deliveries/${dId}/items`).send({ product_id: pId, warehouse_id: wId1, quantity: 10 });
        
        // Validate
        await request(app).post(`/api/deliveries/${dId}/validate`);
        
        // Verify ledger
        const entries = db.prepare("SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 1").get();
        assert.ok(entries);
        assert.strictEqual(entries.operation_type, 'Delivery');
        assert.strictEqual(entries.quantity_change, -10);
        assert.strictEqual(entries.source_warehouse_id, wId1);
        assert.strictEqual(entries.product_id, pId);
    });

    it('should create a ledger entry on Transfer validation', async () => {
        // Create transfer & item
        const result1 = await request(app).post('/api/transfers').send({ source_warehouse_id: wId1, dest_warehouse_id: wId2 });
        const tId = result1.body.id;
        await request(app).post(`/api/transfers/${tId}/items`).send({ product_id: pId, quantity: 5 });
        
        // Validate
        await request(app).post(`/api/transfers/${tId}/validate`);
        
        // Verify ledger
        const entries = db.prepare("SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 1").get();
        assert.ok(entries);
        assert.strictEqual(entries.operation_type, 'Internal Transfer');
        assert.strictEqual(entries.quantity_change, 5);
        assert.strictEqual(entries.source_warehouse_id, wId1);
        assert.strictEqual(entries.dest_warehouse_id, wId2);
        assert.strictEqual(entries.product_id, pId);
    });

    it('should create a ledger entry on manual stock Adjustment', async () => {
        // Adjust stock up by 2
        // Warehouse 1 started at 50, +15 (Receipt), -10 (Delivery), -5 (Transfer) = 50.
        await request(app).post('/api/adjustments').send({ product_id: pId, warehouse_id: wId1, new_quantity: 52 });
        
        // Verify ledger
        const entries = db.prepare("SELECT * FROM stock_ledger ORDER BY id DESC LIMIT 1").get();
        assert.ok(entries);
        assert.strictEqual(entries.operation_type, 'Adjustment');
        assert.strictEqual(entries.quantity_change, 2);
        assert.strictEqual(entries.dest_warehouse_id, wId1); // Diff > 0 goes to dest
        assert.strictEqual(entries.source_warehouse_id, null);
        assert.strictEqual(entries.product_id, pId);
    });
});
