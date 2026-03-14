const express = require('express');
const path = require('path');
const cors = require('cors');

const { createDb } = require('./db');
const authRouter = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── ROUTES ──────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Serve frontend pages
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/signup', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'signup.html')));
app.get('/forgot', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'forgot.html')));
app.get('/verify-otp', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'verify-otp.html')));
app.get('/reset', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'reset.html')));
app.get('/profile', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'profile.html')));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ─── START ───────────────────────────────────────────────────
async function bootstrap() {
    const db = await createDb();
    app.locals.db = db;

    app.listen(PORT, () => {
        console.log(`\n🚀 IMS Server running at http://localhost:${PORT}`);
        console.log(`   Login:     http://localhost:${PORT}/`);
        console.log(`   Dashboard: http://localhost:${PORT}/dashboard\n`);
    });
}

if (require.main === module) {
    bootstrap().catch(err => { console.error('Server failed to start:', err); process.exit(1); });
}

module.exports = { app, createApp: async () => { const db = await createDb(':memory:'); app.locals.db = db; return app; } };
