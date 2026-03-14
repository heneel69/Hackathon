import initSqlJs from 'sql.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, '..', 'data');
if (process.env.NODE_ENV !== 'test') {
  mkdirSync(dbDir, { recursive: true });
}
const DB_PATH = process.env.NODE_ENV === 'test' ? ':memory:' : join(dbDir, 'ims.db');

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (DB_PATH !== ':memory:' && existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Schema updates for existing databases
  try { db.run('ALTER TABLE users ADD COLUMN is_validated INTEGER DEFAULT 1'); } catch (e) { /* Ignore if it already exists */ }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      unit_of_measure TEXT NOT NULL,
      initial_stock INTEGER DEFAULT 0,
      min_stock_threshold INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS warehouse_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 0,
      UNIQUE(product_id, warehouse_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Warehouse Staff'
                          CHECK(role IN ('Inventory Manager', 'Warehouse Staff')),
      is_validated INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    )
  `);

  // ===== Module 3: Core Inventory Operations =====

  db.run(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Validated')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Picking','Packing','Validated')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      dest_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Validated')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      old_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ===== Module 4: Move History & Logging (The Ledger) =====

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_change INTEGER NOT NULL,
      source_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
      dest_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
      operation_type TEXT NOT NULL CHECK(operation_type IN ('Receipt', 'Delivery', 'Internal Transfer', 'Adjustment')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Enforce Append-Only Log: Prevent Updates
  db.run(`
    CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_update
    BEFORE UPDATE ON stock_ledger
    BEGIN
      SELECT RAISE(ABORT, 'Stock Ledger records are immutable and cannot be updated.');
    END;
  `);

  // Enforce Append-Only Log: Prevent Deletes
  db.run(`
    CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_delete
    BEFORE DELETE ON stock_ledger
    BEGIN
      SELECT RAISE(ABORT, 'Stock Ledger records are immutable and cannot be deleted.');
    END;
  `);

  saveDb();
  return db;
}

function saveDb() {
  if (!db || DB_PATH === ':memory:') return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// Helper: run a query and return all results as array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query and return first result as object
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: run an INSERT/UPDATE/DELETE and return { changes, lastInsertRowid }
function runSql(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = queryOne('SELECT last_insert_rowid() as id');
  saveDb();
  return { changes, lastInsertRowid: lastId ? lastId.id : 0 };
}

// Add createDb mock for tests compatibility
async function createDb(memory) {
  // force memory DB by setting process env before getDb
  if (memory && memory.startsWith(':memory:')) {
    process.env.NODE_ENV = 'test';
    if (db) {
      db.close();
      db = null; // Forces a brand new SQL.Database() instance
    }
  }
  
  // getDb will check if db is null and create a new one using initSqlJs
  await getDb();
  
  return {
    prepare: (sql) => {
      return {
        get: (...params) => queryOne(sql, params),
        all: (...params) => queryAll(sql, params),
        run: (...params) => runSql(sql, params),
      }
    },
    exec: (sql) => runSql(sql),
    close: () => {
       if (db && process.env.NODE_ENV === 'test') {
          db.close();
          db = null;
       }
    }
  }
}

export { getDb, queryAll, queryOne, runSql, saveDb, DB_PATH, createDb };
export default { getDb, queryAll, queryOne, runSql, saveDb };
