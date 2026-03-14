/**
 * db.js — SQLite wrapper using sql.js (pure-JS WebAssembly, no native build).
 *
 * Exports:
 *   createDb(filePath?)  — returns a DB object with a synchronous API
 *                          matching the shape used throughout the app.
 *
 * Shape of returned db object:
 *   db.prepare(sql).get(params...)
 *   db.prepare(sql).all(params...)
 *   db.prepare(sql).run(params...)
 *   db.exec(sql)
 *   db.close()
 *   db.pragma(...)  — no-op shim (sql.js handles this differently)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Cache the initialized SQL engine so we don't re-init on every createDb call
let _SQL = null;

async function getSql() {
    if (!_SQL) {
        _SQL = await initSqlJs();
    }
    return _SQL;
}

/**
 * Synchronous-style wrapper around sql.js.
 * sql.js is synchronous internally (WASM); the only async part is the
 * one-time module initialisation, which we handle via a factory.
 */
class SqlJsDb {
    constructor(sqlJs, filePath) {
        this._filePath = filePath; // undefined / ':memory:' for in-memory
        this._persist = filePath && filePath !== ':memory:';

        if (this._persist && fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            this._db = new sqlJs.Database(fileBuffer);
        } else {
            this._db = new sqlJs.Database();
        }
    }

    /** No-op shim — sql.js sets pragmas automatically */
    pragma(_stmt) { }

    exec(sql) {
        this._db.run(sql);
        this._save();
    }

    /** Returns a statement-like object with .get() / .all() / .run() */
    prepare(sql) {
        const self = this;
        return {
            get(...params) {
                const stmt = self._db.prepare(sql);
                stmt.bind(params);
                const row = stmt.step() ? stmt.getAsObject() : undefined;
                stmt.free();
                return row;
            },
            all(...params) {
                const stmt = self._db.prepare(sql);
                stmt.bind(params);
                const rows = [];
                while (stmt.step()) rows.push(stmt.getAsObject());
                stmt.free();
                return rows;
            },
            run(...params) {
                const stmt = self._db.prepare(sql);
                stmt.run(params);
                stmt.free();
                const lastInsertRowid = self._db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
                self._save();
                return { lastInsertRowid };
            },
        };
    }

    /** Persist to disk when using a file path */
    _save() {
        if (this._persist) {
            const data = this._db.export();
            const buf = Buffer.from(data);
            fs.writeFileSync(this._filePath, buf);
        }
    }

    close() {
        this._db.close();
    }
}

/**
 * SQL schema — run once on init.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password_hash TEXT  NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'Warehouse Staff'
                        CHECK(role IN ('Inventory Manager', 'Warehouse Staff')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * createDb(filePath?) — factory.
 * Returns a promise that resolves to a SqlJsDb instance with the schema applied.
 * For parity with sync callers we also expose createDbSync (used in server).
 */
async function createDb(filePath = path.join(__dirname, '..', 'ims.db')) {
    const SQL = await getSql();
    const db = new SqlJsDb(SQL, filePath);
    db._db.run(SCHEMA);
    return db;
}

/**
 * createDbMemory() — in-memory async shorthand for tests.
 */
async function createDbMemory() {
    return createDb(':memory:');
}

module.exports = { createDb, createDbMemory };
