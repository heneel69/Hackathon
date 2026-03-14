// ===== Products Tests (Part 1) =====
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Part 1: Product Master Data', () => {
  before(async () => {
    const helpers = await createTestDb();
    db = helpers.db;
    queryAll = helpers.queryAll;
    queryOne = helpers.queryOne;
    runSql = helpers.runSql;
  });

  after(() => cleanupTestDb(db));

  it('should create a product with all required fields', () => {
    const result = runSql(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, initial_stock)
       VALUES (?, ?, ?, ?, ?)`,
      ['Steel Rods', 'SR-001', null, 'Kg', 100]
    );

    const product = queryOne('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    assert.ok(product, 'Product should exist');
    assert.equal(product.name, 'Steel Rods');
    assert.equal(product.sku, 'SR-001');
    assert.equal(product.unit_of_measure, 'Kg');
    assert.equal(product.initial_stock, 100);
    console.log('✅ Unit Test: Product created with all required fields');
  });

  it('should reject duplicate SKU', () => {
    // First product already created above (SR-001)
    assert.throws(() => {
      runSql(
        `INSERT INTO products (name, sku, unit_of_measure, initial_stock)
         VALUES (?, ?, ?, ?)`,
        ['Duplicate Product', 'SR-001', 'Kg', 50]
      );
    }, /UNIQUE constraint failed/);
    console.log('✅ Validation Test: Duplicate SKU rejected');
  });

  it('should default initial_stock to 0 when omitted', () => {
    const result = runSql(
      `INSERT INTO products (name, sku, unit_of_measure)
       VALUES (?, ?, ?)`,
      ['Copper Wire', 'CW-001', 'Meters']
    );

    const product = queryOne('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    assert.ok(product, 'Product should exist');
    assert.equal(product.initial_stock, 0, 'initial_stock should default to 0');
    console.log('✅ Integration Test: Initial stock defaults to 0');
  });
});
