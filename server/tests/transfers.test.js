// ===== Internal Transfers Tests (Part 3) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Module 3 Part 3: Internal Transfers', () => {
  before(async () => {
    const h = await createTestDb();
    db = h.db; queryAll = h.queryAll; queryOne = h.queryOne; runSql = h.runSql;

    // Seed: 2 warehouses + product with 100 units in WH1
    runSql('INSERT INTO warehouses (name) VALUES (?)', ['Main Store']);
    runSql('INSERT INTO warehouses (name) VALUES (?)', ['Production Rack']);
    runSql('INSERT INTO products (name, sku, unit_of_measure, initial_stock) VALUES (?, ?, ?, ?)',
      ['Steel Rods', 'SR-001', 'Kg', 100]);
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['SR-001']);
    const wh1 = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Store']);
    runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
      [product.id, wh1.id, 100]);
  });

  after(() => cleanupTestDb(db));

  it('LOGIC TEST: transfer 50 units from Main Store to Production Rack', () => {
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['SR-001']);
    const srcWh = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Store']);
    const destWh = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Production Rack']);

    // Create transfer + add item
    const transfer = runSql('INSERT INTO transfers (source_warehouse_id, dest_warehouse_id) VALUES (?, ?)',
      [srcWh.id, destWh.id]);
    runSql('INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)',
      [transfer.lastInsertRowid, product.id, 50]);

    // Validate: move stock
    const items = queryAll('SELECT * FROM transfer_items WHERE transfer_id = ?', [transfer.lastInsertRowid]);
    for (const item of items) {
      // Decrease source
      runSql('UPDATE warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
        [item.quantity, item.product_id, srcWh.id]);
      // Increase destination
      const destStock = queryOne('SELECT * FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, destWh.id]);
      if (destStock) {
        runSql('UPDATE warehouse_stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
          [item.quantity, item.product_id, destWh.id]);
      } else {
        runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [item.product_id, destWh.id, item.quantity]);
      }
    }
    runSql('UPDATE transfers SET status = ? WHERE id = ?', ['Validated', transfer.lastInsertRowid]);

    console.log('✅ Logic Test: Transfer of 50 units validated');
  });

  it('DATA INTEGRITY TEST: global stock unchanged, locations updated', () => {
    const product = queryOne('SELECT * FROM products WHERE sku = ?', ['SR-001']);
    const srcWh = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Store']);
    const destWh = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Production Rack']);

    // Check per-location stock
    const srcStock = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, srcWh.id]);
    const destStock = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, destWh.id]);

    assert.equal(srcStock.quantity, 50, 'Main Store should have 50 (was 100, moved 50)');
    assert.equal(destStock.quantity, 50, 'Production Rack should have 50');

    // Verify GLOBAL total unchanged
    const allStock = queryAll('SELECT SUM(quantity) as total FROM warehouse_stock WHERE product_id = ?', [product.id]);
    assert.equal(allStock[0].total, 100, 'Total global stock must remain 100 (unchanged)');

    console.log('✅ Data Integrity Test: Global stock = 100, Main Store = 50, Production Rack = 50');
  });
});
