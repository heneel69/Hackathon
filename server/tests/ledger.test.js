import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createDb } from '../db.js';

describe('Module 4: Stock Ledger Database Constraints', () => {
    let db;
    let productId;
    let userId;

    before(async () => {
        db = await createDb(':memory:');
        
        // Setup initial data needed for foreign keys
        db.exec("INSERT INTO categories (name) VALUES ('Ledger Test Cat')");
        const catRes = db.prepare("SELECT id FROM categories WHERE name = 'Ledger Test Cat'").get();
        
        db.exec(`INSERT INTO products (name, sku, category_id, unit_of_measure) VALUES ('Ledger Item', 'LEDG-1', ${catRes.id}, 'pcs')`);
        productId = db.prepare("SELECT id FROM products WHERE sku = 'LEDG-1'").get().id;
        
        db.exec("INSERT INTO users (name, email, password_hash, role) VALUES ('Ledger User', 'ledger@test.com', 'hash', 'Warehouse Staff')");
        userId = db.prepare("SELECT id FROM users WHERE email = 'ledger@test.com'").get().id;
    });

    after(() => {
        db.close();
    });

    it('should successfully insert a valid stock ledger entry', () => {
        const result = db.prepare(`
            INSERT INTO stock_ledger (product_id, quantity_change, operation_type, user_id)
            VALUES (?, ?, ?, ?)
        `).run(productId, 10, 'Receipt', userId);

        assert.ok(result.lastInsertRowid > 0);
        assert.strictEqual(result.changes, 1);

        const entry = db.prepare('SELECT * FROM stock_ledger WHERE id = ?').get(result.lastInsertRowid);
        assert.ok(entry);
        assert.strictEqual(entry.product_id, productId);
        assert.strictEqual(entry.quantity_change, 10);
        assert.strictEqual(entry.operation_type, 'Receipt');
        assert.strictEqual(entry.user_id, userId);
        assert.ok(entry.created_at); // Should auto-populate timestamp
    });

    it('should block updating an existing stock ledger entry', () => {
        // Insert a new entry
        const result = db.prepare(`
            INSERT INTO stock_ledger (product_id, quantity_change, operation_type, user_id)
            VALUES (?, ?, ?, ?)
        `).run(productId, -5, 'Delivery', userId);
        const ledgerId = result.lastInsertRowid;

        // Try to update it - should fail due to trigger
        let errorEncountered = null;
        try {
            db.prepare('UPDATE stock_ledger SET quantity_change = -10 WHERE id = ?').run(ledgerId);
        } catch (err) {
            errorEncountered = err;
        }

        assert.ok(errorEncountered, 'Expected an error when updating the stock ledger');
        assert.match(errorEncountered.message, /Stock Ledger records are immutable and cannot be updated/);
    });

    it('should block deleting an existing stock ledger entry', () => {
        // Insert a new entry
        const result = db.prepare(`
            INSERT INTO stock_ledger (product_id, quantity_change, operation_type, user_id)
            VALUES (?, ?, ?, ?)
        `).run(productId, 2, 'Adjustment', userId);
        const ledgerId = result.lastInsertRowid;

        // Try to delete it - should fail due to trigger
        let errorEncountered = null;
        try {
            db.prepare('DELETE FROM stock_ledger WHERE id = ?').run(ledgerId);
        } catch (err) {
            errorEncountered = err;
        }

        assert.ok(errorEncountered, 'Expected an error when deleting from the stock ledger');
        assert.match(errorEncountered.message, /Stock Ledger records are immutable and cannot be deleted/);
    });
});
