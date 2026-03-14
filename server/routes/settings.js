import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const rows = queryAll('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings - Update or create setting
router.post('/', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload' });
    }

    Object.keys(settings).forEach(key => {
      const existing = queryOne('SELECT * FROM settings WHERE setting_key = ?', [key]);
      if (existing) {
        runSql('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [String(settings[key]), key]);
      } else {
        runSql('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, String(settings[key])]);
      }
    });

    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
