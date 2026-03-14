/**
 * Part 2 Tests — Sign-up, Login & Redirection
 * Integration tests via supertest
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const { createDb } = require('../server/db');
const { JWT_SECRET } = require('../server/middleware');
const authRouter = require('../server/auth');

let app;

beforeAll(async () => {
    const db = await createDb(':memory:');
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.locals.db = db;
    testApp.use('/api/auth', authRouter);
    app = testApp;
});

describe('Part 2 — Registration', () => {
    test('should register a new user and return 201', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Alice Manager', email: 'alice@test.com', password: 'SecurePass1!', role: 'Inventory Manager' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('userId');
        expect(res.body.message).toMatch(/created/i);
    });

    test('should reject duplicate email with 409', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Alice Duplicate', email: 'alice@test.com', password: 'AnotherPass1!' });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already registered/i);
    });

    test('should reject registration with missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'incomplete@test.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });
});

describe('Part 2 — Login', () => {
    test('should reject login with unregistered credentials and return 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nosuchuser@test.com', password: 'WrongPass!' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    test('should reject login with correct email but wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice@test.com', password: 'WrongPassword!' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid/i);
    });

    test('should return a JWT token on valid login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice@test.com', password: 'SecurePass1!' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
    });

    test('returned JWT should contain correct user fields', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice@test.com', password: 'SecurePass1!' });

        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        expect(decoded.email).toBe('alice@test.com');
        expect(decoded.name).toBe('Alice Manager');
        expect(decoded.role).toBe('Inventory Manager');
        expect(decoded).toHaveProperty('id');
    });

    test('should return user info alongside the token', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice@test.com', password: 'SecurePass1!' });

        expect(res.body).toHaveProperty('user');
        expect(res.body.user.email).toBe('alice@test.com');
    });
});
