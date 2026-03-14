// ===== Warehouse Tests (Part 3) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Part 3: Warehouse & Location Settings', () => {
  before(async () => {
    const helpers = await createTestDb();
    db = helpers.db;
    queryAll = helpers.queryAll;
    queryOne = helpers.queryOne;
    runSql = helpers.runSql;
  });

  after(() => cleanupTestDb(db));

  it('should create warehouses and track per-location stock', () => {
    // Create "Warehouse 1" and "Warehouse 2"
    const wh1 = runSql('INSERT INTO warehouses (name, address) VALUES (?, ?)', ['Warehouse 1', '123 Industrial Way']);
    const wh2 = runSql('INSERT INTO warehouses (name, address) VALUES (?, ?)', ['Warehouse 2', '45 Distribution Blvd']);

    const warehouse1 = queryOne('SELECT * FROM warehouses WHERE id = ?', [wh1.lastInsertRowid]);
    const warehouse2 = queryOne('SELECT * FROM warehouses WHERE id = ?', [wh2.lastInsertRowid]);
    assert.equal(warehouse1.name, 'Warehouse 1');
    assert.equal(warehouse2.name, 'Warehouse 2');

    // Create a product
    const prod = runSql(
      'INSERT INTO products (name, sku, unit_of_measure) VALUES (?, ?, ?)',
      ['Steel Rods', 'SR-WH', 'Kg']
    );

    // Add 10 units to Warehouse 1, 5 to Warehouse 2
    runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
      [prod.lastInsertRowid, wh1.lastInsertRowid, 10]);
    runSql('INSERT INTO warehouse_stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
      [prod.lastInsertRowid, wh2.lastInsertRowid, 5]);

    console.log('✅ Database Test: Created 2 warehouses and added split stock');
  });

  it('should correctly report per-location stock split', () => {
    // Get the product
    const product = queryOne('SELECT * FROM products WHERE sku = ?', ['SR-WH']);
    assert.ok(product, 'Product should exist');

    // Query stock per location
    const stockByLocation = queryAll(
      `SELECT ws.quantity, w.name as warehouse_name
       FROM warehouse_stock ws
       JOIN warehouses w ON ws.warehouse_id = w.id
       WHERE ws.product_id = ?
       ORDER BY w.name ASC`,
      [product.id]
    );

    assert.equal(stockByLocation.length, 2, 'Should have stock in 2 warehouses');

    const wh1Stock = stockByLocation.find(s => s.warehouse_name === 'Warehouse 1');
    const wh2Stock = stockByLocation.find(s => s.warehouse_name === 'Warehouse 2');

    assert.equal(wh1Stock.quantity, 10, 'Warehouse 1 should have 10 units');
    assert.equal(wh2Stock.quantity, 5, 'Warehouse 2 should have 5 units');

    // Verify it's NOT just returning "15 total"
    const totalStock = stockByLocation.reduce((s, item) => s + item.quantity, 0);
    assert.equal(totalStock, 15, 'Total should be 15');
    assert.notEqual(stockByLocation.length, 1, 'Should NOT be a single aggregated row');

    console.log('✅ Query Test: Stock correctly reports split (10 and 5) not generic "15 total"');
  });
});
