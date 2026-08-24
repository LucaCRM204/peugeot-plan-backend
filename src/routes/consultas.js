const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const consultaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { error: 'Demasiadas consultas seguidas. Probá de nuevo en un rato.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/consultas
 * Público — el formulario de la landing pega acá.
 */
router.post(
  '/',
  consultaLimiter,
  [
    body('nombre').isString().trim().isLength({ min: 2, max: 191 }),
    body('telefono').isString().trim().isLength({ min: 6, max: 50 }),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
    body('mensaje').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
    body('vehiculo_id').optional({ nullable: true }).isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Revisá los datos del formulario', detalles: errors.array() });
    }

    const { nombre, telefono, email, mensaje, vehiculo_id, origen } = req.body;

    await pool.query(
      'INSERT INTO consultas (vehiculo_id, nombre, telefono, email, mensaje, origen) VALUES (?, ?, ?, ?, ?, ?)',
      [vehiculo_id || null, nombre, telefono, email || null, mensaje || null, origen || 'formulario']
    );

    res.status(201).json({ ok: true });
  }
);

/**
 * GET /api/admin/consultas
 * Panel — lista de consultas recibidas, más recientes primero.
 */
router.get('/admin/todas', requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.*, v.nombre AS vehiculo_nombre, v.version AS vehiculo_version
    FROM consultas c
    LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
    ORDER BY c.created_at DESC
    LIMIT 200
  `);
  res.json(rows);
});

/**
 * DELETE /api/admin/consultas/:id
 * Panel — borrar una consulta ya atendida.
 */
router.delete('/admin/:id', requireAuth, param('id').isInt(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  await pool.query('DELETE FROM consultas WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
