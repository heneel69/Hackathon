import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, runSql } from './db.js';
const router = express.Router();

import { protect, JWT_SECRET } from './middleware.js';
import { generateOtp, verifyOtp, markResetAllowed, isResetAllowed, clearResetAllowed } from './otp-store.js';
import { sendOtpEmail } from './mailer.js';

// ─── REGISTER ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }

        const allowedRoles = ['Inventory Manager', 'Warehouse Staff'];
        const userRole = allowedRoles.includes(role) ? role : 'Warehouse Staff';

        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email is already registered.' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const result = runSql(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, password_hash, userRole]
        );

        return res.status(201).json({ message: 'Account created successfully.', userId: result.lastInsertRowid });
    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        return res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

// ─── LOGIN ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
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
    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        return res.status(500).json({ error: 'Internal server error during login.' });
    }
});

// ─── ME (protected) ──────────────────────────────────────────
router.get('/me', protect, (req, res) => {
    try {
        const user = queryOne('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        return res.status(200).json({ user });
    } catch (err) {
        console.error('[ME ERROR]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const user = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (user) {
            const otp = generateOtp(email);
            // Send via Gmail (falls back to console log if env vars not set)
            try {
                await sendOtpEmail(email, otp);
            } catch (mailErr) {
                console.error('[MAILER] Failed to send email, falling back to console:', mailErr.message);
                console.log(`\n[OTP FALLBACK] Password reset OTP for ${email}: ${otp}\n`);
            }
        }

        return res.status(200).json({ message: 'If that email is registered, an OTP has been sent.' });
    } catch (err) {
        console.error('[FORGOT ERROR]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const valid = verifyOtp(email, otp);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' });

    markResetAllowed(email);
    return res.status(200).json({ message: 'OTP verified. You may now reset your password.' });
});

// ─── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required.' });

        if (!isResetAllowed(email)) return res.status(403).json({ error: 'Reset not authorized. Verify OTP first.' });
        if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

        const user = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const password_hash = await bcrypt.hash(newPassword, 12);
        // Update password and clear any stale reset tokens
        runSql('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE email = ?', [password_hash, email]);

        clearResetAllowed(email);
        return res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (err) {
        console.error('[RESET ERROR]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ─── UPDATE PASSWORD (Authenticated) ──────────────────────────
router.put('/update-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'New password must be different from current password.' });
        }

        const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

        const password_hash = await bcrypt.hash(newPassword, 12);
        runSql('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [password_hash, req.user.id]);

        return res.status(200).json({ message: 'Password updated successfully. Please log in again.' });
    } catch (err) {
        console.error('[UPDATE_PASSWORD ERROR]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
