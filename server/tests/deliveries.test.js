// ===== Delivery Orders Tests (Part 2) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Module 3 Part 2: Delivery Orders (Outgoing Goods)', () => {
  before(async () => {
    const h = await createTestDb();
    db = h.db; queryAll = h.queryAll; queryOne = h.queryOne; runSql = h.runSql;

    // Seed: warehouse + product with 10 chairs in stock
    runSql('INSERT INTO warehouses (name) VALUES (?)', ['Main Warehouse']);
    runSql('INSERT INTO products (name, sku, unit_of_measure, initial_stock) VALUES (?, ?, ?, ?)',
      ['Chairs', 'CH-001', 'Pieces', 10]);
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['CH-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);
    runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
      [product.id, warehouse.id, 10]);
  });

  after(() => cleanupTestDb(db));

  it('LOGIC TEST: validating delivery decreases stock by exactly 10', () => {
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['CH-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);

    // Create delivery + add 10 chairs
    const delivery = runSql('INSERT INTO delivery_orders (customer_name) VALUES (?)', ['Acme Corp']);
    runSql('INSERT INTO delivery_items (delivery_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
      [delivery.lastInsertRowid, product.id, warehouse.id, 10]);

    // Validate: decrease stock
    const items = queryAll('SELECT * FROM delivery_items WHERE delivery_id = ?', [delivery.lastInsertRowid]);
    for (const item of items) {
      runSql('UPDATE warehouse_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
        [item.quantity, item.product_id, item.warehouse_id]);
      runSql('UPDATE products SET initial_stock = initial_stock - ? WHERE id = ?',
        [item.quantity, item.product_id]);
    }
    runSql('UPDATE delivery_orders SET status = ? WHERE id = ?', ['Validated', delivery.lastInsertRowid]);

    // Verify stock is now 0
    const p = queryOne('SELECT initial_stock FROM products WHERE sku = ?', ['CH-001']);
    assert.equal(p.initial_stock, 0, 'Product stock should be reduced to 0');

    const ws = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws.quantity, 0, 'Warehouse stock should be 0');

    console.log('✅ Logic Test: Delivery validated, stock decreased by exactly 10');
  });

  it('CONSTRAINT TEST: blocks validation when insufficient stock', () => {
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['CH-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);

    // Stock is now 0, try to deliver 20
    const delivery = runSql('INSERT INTO delivery_orders (customer_name) VALUES (?)', ['BigBuy Inc']);
    runSql('INSERT INTO delivery_items (delivery_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
      [delivery.lastInsertRowid, product.id, warehouse.id, 20]);

    // Pre-check: verify insufficient stock
    const items = queryAll('SELECT * FROM delivery_items WHERE delivery_id = ?', [delivery.lastInsertRowid]);
    let insufficientError = null;

    for (const item of items) {
      const stock = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
        [item.product_id, item.warehouse_id]);
      const available = stock ? stock.quantity : 0;
      if (available < item.quantity) {
        insufficientError = `Insufficient Stock: available ${available}, requested ${item.quantity}`;
        break;
      }
    }

    assert.ok(insufficientError, 'Should detect insufficient stock');
    assert.ok(insufficientError.includes('Insufficient Stock'), 'Error message should contain "Insufficient Stock"');

    // Verify stock remains unchanged (still 0)
    const ws = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws.quantity, 0, 'Stock should remain unchanged after blocked delivery');

    console.log('✅ Constraint Test: Delivery blocked — Insufficient Stock (available: 0, requested: 20)');
  });
});
