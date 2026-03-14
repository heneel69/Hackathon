/**
 * Part 3 Tests — OTP-Based Password Reset
 * Unit, Integration, and Security tests
 */
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { createDb } = require('../server/db');
const { generateOtp, verifyOtp, _getStore } = require('../server/otp-store');
const authRouter = require('../server/auth');

let app;
const TEST_EMAIL = 'otp.user@test.com';

beforeAll(async () => {
    const db = await createDb(':memory:');
    const hash = await bcrypt.hash('InitialPass1!', 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run('OTP User', TEST_EMAIL, hash, 'Warehouse Staff');

    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.locals.db = db;
    testApp.use('/api/auth', authRouter);
    app = testApp;
});

describe('Part 3 — OTP Generation (Unit)', () => {
    test('should generate a 6-digit numeric OTP', () => {
        const otp = generateOtp('unit@test.com');
        expect(otp).toMatch(/^\d{6}$/);
    });

    test('generated OTP should be 4–6 digits long', () => {
        const otp = generateOtp('unit2@test.com');
        expect(otp.length).toBeGreaterThanOrEqual(4);
        expect(otp.length).toBeLessThanOrEqual(6);
    });

    test('OTP should be stored in the in-memory store and linked to the correct email', () => {
        const email = 'linked@test.com';
        const otp = generateOtp(email);
        const store = _getStore();
        const entry = store.get(email.toLowerCase());
        expect(entry).toBeDefined();
        expect(entry.otp).toBe(otp);
    });

    test('OTP entry should have a future expiry time', () => {
        generateOtp('expiry@test.com');
        const store = _getStore();
        const entry = store.get('expiry@test.com');
        expect(entry.expiresAt).toBeGreaterThan(Date.now());
    });
});

describe('Part 3 — OTP Verification (Integration)', () => {
    test('POST /forgot-password should respond 200 for a registered user', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: TEST_EMAIL });
        expect(res.status).toBe(200);
        expect(res.body.message).toBeDefined();
    });

    test('should allow password reset after submitting the correct OTP', async () => {
        const otp = generateOtp(TEST_EMAIL);

        const verifyRes = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: TEST_EMAIL, otp });
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.message).toMatch(/verified/i);

        const resetRes = await request(app)
            .post('/api/auth/reset-password')
            .send({ email: TEST_EMAIL, newPassword: 'NewSecurePass2!' });
        expect(resetRes.status).toBe(200);
        expect(resetRes.body.message).toMatch(/reset/i);
    });
});

describe('Part 3 — OTP Security', () => {
    test('should reject an incorrect OTP', async () => {
        generateOtp(TEST_EMAIL);

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: TEST_EMAIL, otp: '000000' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid|expired/i);
    });

    test('should reject an expired OTP', () => {
        const email = 'expired@test.com';
        const store = _getStore();
        store.set(email.toLowerCase(), { otp: '999999', expiresAt: Date.now() - 1000 });

        const valid = verifyOtp(email, '999999');
        expect(valid).toBe(false);
    });

    test('should reject password reset without prior OTP verification', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ email: 'nootp@test.com', newPassword: 'NewPass123!' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/not authorized|verify/i);
    });

    test('OTP should be single-use (consumed after first successful verify)', () => {
        const email = 'singleuse@test.com';
        const otp = generateOtp(email);

        const first = verifyOtp(email, otp);
        expect(first).toBe(true);

        const second = verifyOtp(email, otp);
        expect(second).toBe(false);
    });
});
