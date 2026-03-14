// ===== Categories & Alerts Tests (Part 2) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Part 2: Categorization & Automated Rules', () => {
  before(async () => {
    const helpers = await createTestDb();
    db = helpers.db;
    queryAll = helpers.queryAll;
    queryOne = helpers.queryOne;
    runSql = helpers.runSql;
  });

  after(() => cleanupTestDb(db));

  it('should CRUD categories and handle deletion gracefully', () => {
    // Create
    const catResult = runSql(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      ['Raw Materials', 'Primary production resources']
    );
    const catId = catResult.lastInsertRowid;
    let cat = queryOne('SELECT * FROM categories WHERE id = ?', [catId]);
    assert.equal(cat.name, 'Raw Materials');
    console.log('  ✅ Create category');

    // Update
    runSql('UPDATE categories SET name = ? WHERE id = ?', ['Raw Materials Updated', catId]);
    cat = queryOne('SELECT * FROM categories WHERE id = ?', [catId]);
    assert.equal(cat.name, 'Raw Materials Updated');
    console.log('  ✅ Update category');

    // Create a product in this category
    runSql(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, initial_stock)
       VALUES (?, ?, ?, ?, ?)`,
      ['Test Product', 'TP-001', catId, 'Kg', 10]
    );
    let product = queryOne('SELECT * FROM products WHERE sku = ?', ['TP-001']);
    assert.equal(product.category_id, catId);

    // Delete category — product should become uncategorized (category_id → NULL)
    runSql('DELETE FROM categories WHERE id = ?', [catId]);
    cat = queryOne('SELECT * FROM categories WHERE id = ?', [catId]);
    assert.equal(cat, null, 'Category should be deleted');

    product = queryOne('SELECT * FROM products WHERE sku = ?', ['TP-001']);
    assert.equal(product.category_id, null, 'Product should be uncategorized');
    console.log('  ✅ Delete category (product set to Uncategorized)');

    console.log('✅ CRUD Test: Category lifecycle passed');
  });

  it('should trigger low-stock alert when stock < threshold', () => {
    // Create "Steel Rods" with min_stock_threshold = 50
    runSql(
      `INSERT INTO products (name, sku, unit_of_measure, initial_stock, min_stock_threshold)
       VALUES (?, ?, ?, ?, ?)`,
      ['Steel Rods', 'SR-ALERT', 'Kg', 49, 50]
    );

    // Query for low-stock alerts
    const alerts = queryAll(
      `SELECT p.name, p.initial_stock as current_stock, p.min_stock_threshold
       FROM products p
       WHERE p.min_stock_threshold IS NOT NULL AND p.initial_stock < p.min_stock_threshold`
    );

    const steelAlert = alerts.find(a => a.name === 'Steel Rods');
    assert.ok(steelAlert, 'Steel Rods should trigger low-stock alert');
    assert.equal(steelAlert.current_stock, 49);
    console.log('✅ Logic Test: Low stock alert triggered at 49 (threshold 50)');
  });

  it('should resolve alert when stock >= threshold', () => {
    // Update stock to 51
    runSql('UPDATE products SET initial_stock = 51 WHERE sku = ?', ['SR-ALERT']);

    const alerts = queryAll(
      `SELECT p.name, p.initial_stock as current_stock, p.min_stock_threshold
       FROM products p
       WHERE p.min_stock_threshold IS NOT NULL AND p.initial_stock < p.min_stock_threshold`
    );

    const steelAlert = alerts.find(a => a.name === 'Steel Rods');
    assert.equal(steelAlert, undefined, 'Steel Rods alert should be resolved');
    console.log('✅ Logic Test: Alert resolved when stock raised to 51');
  });
});
