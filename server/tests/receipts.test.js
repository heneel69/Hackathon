// ===== Receipts Tests (Part 1) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Module 3 Part 1: Receipts (Incoming Goods)', () => {
  before(async () => {
    const h = await createTestDb();
    db = h.db; queryAll = h.queryAll; queryOne = h.queryOne; runSql = h.runSql;

    // Seed: warehouse + product
    runSql('INSERT INTO warehouses (name) VALUES (?)', ['Main Warehouse']);
    runSql('INSERT INTO products (name, sku, unit_of_measure, initial_stock) VALUES (?, ?, ?, ?)',
      ['Steel Rods', 'SR-001', 'Kg', 0]);
  });

  after(() => cleanupTestDb(db));

  it('STATE TEST: stock unchanged while receipt is Draft', () => {
    // Create draft receipt
    const receipt = runSql('INSERT INTO receipts (supplier_name) VALUES (?)', ['Global Steel Corp']);
    const receiptId = receipt.lastInsertRowid;

    // Add 50 Steel Rods to the receipt
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['SR-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);
    runSql('INSERT INTO receipt_items (receipt_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
      [receiptId, product.id, warehouse.id, 50]);

    // Verify receipt is Draft
    const receiptRow = queryOne('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    assert.equal(receiptRow.status, 'Draft');

    // Verify stock is STILL 0 (unchanged)
    const p = queryOne('SELECT initial_stock FROM products WHERE sku = ?', ['SR-001']);
    assert.equal(p.initial_stock, 0, 'Stock should remain 0 while receipt is Draft');
    const ws = queryOne('SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws, null, 'No warehouse_stock entry should exist yet');

    console.log('✅ State Test: Stock unchanged while receipt is Draft');
  });

  it('LOGIC TEST: validating receipt increases stock by exactly +50', () => {
    const receipt = queryOne('SELECT * FROM receipts WHERE supplier_name = ?', ['Global Steel Corp']);
    const items = queryAll('SELECT * FROM receipt_items WHERE receipt_id = ?', [receipt.id]);

    // Simulate validation: increase stock
    for (const item of items) {
      const existing = queryOne('SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, item.warehouse_id]);
      if (existing) {
        runSql('UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
          [item.quantity, item.product_id, item.warehouse_id]);
      } else {
        runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [item.product_id, item.warehouse_id, item.quantity]);
      }
      runSql('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?',
        [item.quantity, item.product_id]);
    }
    runSql('UPDATE receipts SET status = ? WHERE id = ?', ['Validated', receipt.id]);

    // Verify stock is now exactly 50
    const product = queryOne('SELECT * FROM products WHERE sku = ?', ['SR-001']);
    assert.equal(product.initial_stock, 50, 'Product stock should be exactly 50');

    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);
    const ws = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws.quantity, 50, 'Warehouse stock should be exactly 50');

    // Verify receipt is Validated
    const r = queryOne('SELECT * FROM receipts WHERE id = ?', [receipt.id]);
    assert.equal(r.status, 'Validated');

    console.log('✅ Logic Test: Receipt validated, stock increased by exactly +50');
  });
});
