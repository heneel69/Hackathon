import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const router = express.Router();

import { protect, JWT_SECRET } from './middleware.js';
import { generateOtp, verifyOtp, markResetAllowed, isResetAllowed, clearResetAllowed } from './otp-store.js';

// DB will be injected via router.db (set by index.js or tests)
function getDb(req) {
    return req.app.locals.db;
}

// ─── REGISTER ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const allowedRoles = ['Inventory Manager', 'Warehouse Staff'];
    const userRole = allowedRoles.includes(role) ? role : 'Warehouse Staff';

    const db = getDb(req);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.status(409).json({ error: 'Email is already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const stmt = db.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(name, email, password_hash, userRole);

    return res.status(201).json({ message: 'Account created successfully.', userId: result.lastInsertRowid });
});

// ─── LOGIN ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDb(req);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.status(200).json({ token, user: payload });
});

// ─── ME (protected) ──────────────────────────────────────────
router.get('/me', protect, (req, res) => {
    const db = getDb(req);
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user });
});

// ─── FORGOT PASSWORD (request OTP) ───────────────────────────
router.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const db = getDb(req);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
        // Return generic message to prevent email enumeration
        return res.status(200).json({ message: 'If that email is registered, an OTP has been sent.' });
    }

    const otp = generateOtp(email);

    // Mock "email send" — log to console
    console.log(`\n[OTP MOCK] Password reset OTP for ${email}: ${otp}\n`);

    return res.status(200).json({ message: 'If that email is registered, an OTP has been sent.' });
});

// ─── VERIFY OTP ───────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const valid = verifyOtp(email, otp);
    if (!valid) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    markResetAllowed(email);
    return res.status(200).json({ message: 'OTP verified. You may now reset your password.' });
});

// ─── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required.' });
    }

    if (!isResetAllowed(email)) {
        return res.status(403).json({ error: 'Reset not authorized. Please verify your OTP first.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const db = getDb(req);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const password_hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(password_hash, email);

    clearResetAllowed(email);
    return res.status(200).json({ message: 'Password has been reset successfully.' });
});

export default router;
