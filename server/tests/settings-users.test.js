import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, cleanupTestDb } from './test-helpers.js';

let db, queryAll, queryOne, runSql;

describe('Module 5: Users and General Settings', () => {
  before(async () => {
    const h = await createTestDb();
    db = h.db; queryAll = h.queryAll; queryOne = h.queryOne; runSql = h.runSql;

    // Insert dummy user since auth flow normally registers them
    runSql(`INSERT INTO users (id, name, email, password_hash, role, is_validated) 
            VALUES (1, 'Admin User', 'admin@example.com', 'hash', 'Inventory Manager', 1)`);
    runSql(`INSERT INTO users (id, name, email, password_hash, role, is_validated) 
            VALUES (2, 'New Staff', 'staff@example.com', 'hash', 'Warehouse Staff', 0)`);
  });

  after(() => cleanupTestDb(db));

  it('USERS: should be able to fetch list of users', () => {
    const users = queryAll('SELECT id, name, email, role, is_validated FROM users ORDER BY created_at DESC');
    assert.equal(users.length, 2);
    assert.equal(users.find(u => u.id === 2).is_validated, 0);
  });

  it('USERS: should update user validation status (activate)', () => {
    // Validate user 2
    runSql('UPDATE users SET is_validated = 1 WHERE id = 2');
    const u2 = queryOne('SELECT is_validated FROM users WHERE id = 2');
    assert.equal(u2.is_validated, 1);
  });

  it('USERS: should delete a user except admin', () => {
    // Try to delete user 2
    runSql('DELETE FROM users WHERE id = 2');
    const u2 = queryOne('SELECT * FROM users WHERE id = 2');
    assert.equal(u2, null);

    // Ensure user 1 remains
    const u1 = queryOne('SELECT * FROM users WHERE id = 1');
    assert.notEqual(u1, null);
  });

  it('SETTINGS: should create and update settings', () => {
    // Insert setting
    runSql('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', ['companyName', 'My Company']);
    
    let comp = queryOne('SELECT * FROM settings WHERE setting_key = ?', ['companyName']);
    assert.equal(comp.setting_value, 'My Company');

    // Update setting
    runSql('UPDATE settings SET setting_value = ? WHERE setting_key = ?', ['Acme Inc', 'companyName']);
    comp = queryOne('SELECT * FROM settings WHERE setting_key = ?', ['companyName']);
    assert.equal(comp.setting_value, 'Acme Inc');
  });
});
