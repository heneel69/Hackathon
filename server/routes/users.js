import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// GET /api/users
router.get('/', (req, res) => {
  try {
    const users = queryAll('SELECT id, name, email, role, is_validated, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Check if user is the last active inventory manager or something
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Prevent deleting admin in tests/dev (e.g. user ID 1)
    if (id === 1) return res.status(400).json({ error: 'Cannot delete the primary admin account.' });
    
    runSql('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/validate - To validate/activate a user
router.put('/:id/validate', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_validated } = req.body;
    
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (id === 1 && !is_validated) return res.status(400).json({ error: 'Cannot invalidate primary admin account.' });

    runSql('UPDATE users SET is_validated = ? WHERE id = ?', [is_validated ? 1 : 0, id]);
    res.json({ message: is_validated ? 'User validated' : 'User validation revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
