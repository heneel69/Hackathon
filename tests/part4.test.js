/**
 * Part 4 Tests — Profile Menu & Session Termination
 * UI structure, protected routes, logout security
 */
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { createDb } = require('../server/db');
const { JWT_SECRET } = require('../server/middleware');
const authRouter = require('../server/auth');

let app;
let validToken;
const TEST_EMAIL = 'p4user@test.com';

beforeAll(async () => {
    const db = await createDb(':memory:');
    const hash = await bcrypt.hash('Part4Pass!1', 10);
    const result = db.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Profile User', TEST_EMAIL, hash, 'Inventory Manager');

    validToken = jwt.sign(
        { id: result.lastInsertRowid, name: 'Profile User', email: TEST_EMAIL, role: 'Inventory Manager' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.locals.db = db;
    testApp.use('/api/auth', authRouter);
    app = testApp;
});

describe('Part 4 — Sidebar / Profile Menu (UI Structure)', () => {
    test('dashboard.html should exist and contain the sidebar element', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf-8');
        expect(html).toContain('sidebar');
    });

    test('dashboard.html should contain the Profile Menu section', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf-8');
        expect(html).toContain('profileMenuSection');
        expect(html).toContain('profileMenuBtn');
    });

    test('dashboard.html should contain "My Profile" link', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf-8');
        expect(html).toContain('myProfileLink');
        expect(html.toLowerCase()).toContain('my profile');
    });

    test('dashboard.html should contain a Logout button', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf-8');
        expect(html).toContain('logoutBtn');
        expect(html.toLowerCase()).toContain('logout');
    });
});

describe('Part 4 — My Profile (Protected Route)', () => {
    test('GET /api/auth/me with valid token should return user details', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty('name', 'Profile User');
        expect(res.body.user).toHaveProperty('email', TEST_EMAIL);
        expect(res.body.user).toHaveProperty('role', 'Inventory Manager');
    });

    test('GET /api/auth/me should return name, email, role, created_at', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${validToken}`);

        const u = res.body.user;
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('role');
        expect(u).toHaveProperty('created_at');
    });
});

describe('Part 4 — Session Termination (Security)', () => {
    test('GET /api/auth/me without token should return 401', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    test('GET /api/auth/me with a tampered token should return 401', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer this.is.not.a.valid.token');

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid|expired/i);
    });

    test('GET /api/auth/me with an expired token should return 401', async () => {
        const expiredToken = jwt.sign(
            { id: 1, name: 'Old User', email: 'old@test.com', role: 'Warehouse Staff' },
            JWT_SECRET,
            { expiresIn: '-1s' }
        );

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
    });

    test('dashboard.js should clear localStorage token on logout', () => {
        const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'dashboard.js'), 'utf-8');
        expect(js).toContain("localStorage.removeItem('ims_token')");
        expect(js).toContain("window.location.replace('/')");
    });

    test('dashboard.js should redirect unauthenticated users to login', () => {
        const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'dashboard.js'), 'utf-8');
        expect(js).toContain("window.location.replace('/')");
    });
});
