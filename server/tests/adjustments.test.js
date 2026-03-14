// ===== Stock Adjustments Tests (Part 4) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Module 3 Part 4: Stock Adjustments', () => {
  before(async () => {
    const h = await createTestDb();
    db = h.db; queryAll = h.queryAll; queryOne = h.queryOne; runSql = h.runSql;

    // Seed: warehouse + product with 100 Kg of steel
    runSql('INSERT INTO warehouses (name) VALUES (?)', ['Main Warehouse']);
    runSql('INSERT INTO products (name, sku, unit_of_measure, initial_stock) VALUES (?, ?, ?, ?)',
      ['Steel', 'ST-001', 'Kg', 100]);
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['ST-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);
    runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
      [product.id, warehouse.id, 100]);
  });

  after(() => cleanupTestDb(db));

  it('NEGATIVE ADJUSTMENT: 3 kg damaged, stock decreases by -3', () => {
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['ST-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);

    // Current stock: 100. Physical count: 97 (3 damaged)
    const oldQty = 100;
    const newQty = 97;
    const diff = newQty - oldQty; // -3

    // Record adjustment
    runSql('INSERT INTO stock_adjustments (product_id, warehouse_id, old_quantity, new_quantity, reason) VALUES (?, ?, ?, ?, ?)',
      [product.id, warehouse.id, oldQty, newQty, 'Damaged goods']);

    // Update warehouse_stock
    runSql('UPDATE warehouse_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
      [newQty, product.id, warehouse.id]);

    // Update product global stock
    runSql('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?',
      [diff, product.id]);

    // Verify
    const ws = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws.quantity, 97, 'Warehouse stock should be 97');

    const p = queryOne('SELECT initial_stock FROM products WHERE sku = ?', ['ST-001']);
    assert.equal(p.initial_stock, 97, 'Product global stock should be 97');

    const adj = queryOne('SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY id DESC', [product.id]);
    assert.equal(adj.old_quantity, 100);
    assert.equal(adj.new_quantity, 97);
    assert.equal(adj.reason, 'Damaged goods');

    console.log('✅ Logic Test (Negative): Stock adjusted from 100 → 97 (diff: -3, reason: Damaged goods)');
  });

  it('POSITIVE ADJUSTMENT: found "lost" inventory, stock increases by +5', () => {
    const product = queryOne('SELECT id FROM products WHERE sku = ?', ['ST-001']);
    const warehouse = queryOne('SELECT id FROM warehouses WHERE name = ?', ['Main Warehouse']);

    // Current stock: 97. Physical count: 102 (found 5 lost units)
    const oldQty = 97;
    const newQty = 102;
    const diff = newQty - oldQty; // +5

    // Record adjustment
    runSql('INSERT INTO stock_adjustments (product_id, warehouse_id, old_quantity, new_quantity, reason) VALUES (?, ?, ?, ?, ?)',
      [product.id, warehouse.id, oldQty, newQty, 'Found on floor']);

    // Update warehouse_stock
    runSql('UPDATE warehouse_stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
      [newQty, product.id, warehouse.id]);

    // Update product global stock
    runSql('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?',
      [diff, product.id]);

    // Verify
    const ws = queryOne('SELECT quantity FROM warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
      [product.id, warehouse.id]);
    assert.equal(ws.quantity, 102, 'Warehouse stock should be 102');

    const p = queryOne('SELECT initial_stock FROM products WHERE sku = ?', ['ST-001']);
    assert.equal(p.initial_stock, 102, 'Product global stock should be 102');

    const adjs = queryAll('SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY id ASC', [product.id]);
    assert.equal(adjs.length, 2, 'Should have 2 adjustment records');
    assert.equal(adjs[1].old_quantity, 97);
    assert.equal(adjs[1].new_quantity, 102);

    console.log('✅ Logic Test (Positive): Stock adjusted from 97 → 102 (diff: +5, reason: Found on floor)');
  });
});
