/**
 * Part 1 Tests — User Schema & Role Management
 * Unit tests: password hashing, role assignment & retrieval
 */
const bcrypt = require('bcryptjs');
const { createDb } = require('../server/db');

let db;

beforeAll(async () => {
    db = await createDb(':memory:');
});

afterAll(() => {
    db.close();
});

describe('Part 1 — Password Hashing', () => {
    test('should store a bcrypt hash, NOT the plain-text password', async () => {
        const plainPassword = 'TestPassword123!';
        const hash = await bcrypt.hash(plainPassword, 12);

        db.prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).run('Hash Tester', 'hash@test.com', hash, 'Warehouse Staff');

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get('hash@test.com');

        expect(user).toBeDefined();
        expect(user.password_hash).not.toBe(plainPassword);
        expect(user.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt signature
    });

    test('stored hash should verify correctly against the original password', async () => {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get('hash@test.com');
        const match = await bcrypt.compare('TestPassword123!', user.password_hash);
        expect(match).toBe(true);
    });

    test('stored hash should NOT verify against a wrong password', async () => {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get('hash@test.com');
        const match = await bcrypt.compare('WrongPassword!', user.password_hash);
        expect(match).toBe(false);
    });
});

describe('Part 1 — Role Management', () => {
    test('should correctly save and retrieve the "Warehouse Staff" role', () => {
        db.prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).run('Warehouse Worker', 'wstaff@test.com', 'dummyhash', 'Warehouse Staff');

        const user = db.prepare('SELECT role FROM users WHERE email = ?').get('wstaff@test.com');
        expect(user.role).toBe('Warehouse Staff');
    });

    test('should correctly save and retrieve the "Inventory Manager" role', () => {
        db.prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).run('Inv Manager', 'imanager@test.com', 'dummyhash', 'Inventory Manager');

        const user = db.prepare('SELECT role FROM users WHERE email = ?').get('imanager@test.com');
        expect(user.role).toBe('Inventory Manager');
    });

    test('should default role to "Warehouse Staff" if not specified', () => {
        db.prepare(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
        ).run('Default Role', 'default@test.com', 'dummyhash');

        const user = db.prepare('SELECT role FROM users WHERE email = ?').get('default@test.com');
        expect(user.role).toBe('Warehouse Staff');
    });

    test('should reject an invalid role value via CHECK constraint', () => {
        expect(() => {
            db.prepare(
                'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
            ).run('Bad Role', 'badrole@test.com', 'dummyhash', 'Superuser');
        }).toThrow();
    });

    test('user record should contain all required schema fields', () => {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get('wstaff@test.com');
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('password_hash');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('created_at');
    });
});
