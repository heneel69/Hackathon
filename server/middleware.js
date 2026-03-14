import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ims-super-secret-key-2024';

/**
 * Middleware: protect routes via JWT in Authorization header.
 * Attaches req.user = { id, name, email, role } on success.
 */
function protect(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

export { protect, JWT_SECRET };
