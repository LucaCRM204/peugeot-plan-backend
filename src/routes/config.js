const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CLAVES_PERMITIDAS = [
  'whatsapp_numero',
  'whatsapp_mensaje_default',
  'telefono_contacto',
  'horario_atencion',
  'instagram_usuario',
  'direccion',
  'nombre_agencia',
];

/**
 * GET /api/config
 * Público — la landing necesita esto para armar los links de WhatsApp,
 * mostrar el teléfono, el horario, etc.
 */
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT clave, valor FROM config_sitio');
  const config = {};
  for (const row of rows) {
    config[row.clave] = row.valor;
  }
  res.json(config);
});

/**
 * PUT /api/admin/config
 * Panel — actualiza una o varias claves a la vez.
 * Body: { whatsapp_numero: "5491157547007", telefono_contacto: "..." }
 */
router.put(
  '/admin',
  requireAuth,
  body().custom((value) => {
    const claves = Object.keys(value);
    const invalidas = claves.filter((c) => !CLAVES_PERMITIDAS.includes(c));
    if (invalidas.length > 0) {
      throw new Error(`Claves no permitidas: ${invalidas.join(', ')}`);
    }
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    for (const [clave, valor] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO config_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
        [clave, String(valor), String(valor)]
      );
    }

    const [rows] = await pool.query('SELECT clave, valor FROM config_sitio');
    const config = {};
    for (const row of rows) config[row.clave] = row.valor;
    res.json(config);
  }
);

module.exports = router;
