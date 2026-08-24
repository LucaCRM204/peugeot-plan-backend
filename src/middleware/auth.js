const jwt = require('jsonwebtoken');

/**
 * Protege rutas del panel admin. Espera un header:
 *   Authorization: Bearer <token>
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
}

module.exports = { requireAuth };
