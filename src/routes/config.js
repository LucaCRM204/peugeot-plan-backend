const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// Multer en memoria, igual que en vehiculosAdmin.js — el archivo pasa
// directo a Cloudinary sin tocar disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB, un logo no necesita más
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Usá JPG, PNG, WEBP o SVG.'));
    }
  },
});

const CLAVES_PERMITIDAS = [
  'logo_url',
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

/**
 * POST /api/config/admin/logo
 * Panel — sube la imagen del logo a Cloudinary y guarda su URL en
 * config_sitio bajo la clave logo_url. Reemplaza el logo anterior si
 * ya había uno.
 */
router.post('/admin/logo', requireAuth, upload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo' });
  }

  try {
    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'peugeot-plan/marca',
          public_id: 'logo',
          overwrite: true,
          // Un logo no necesita recorte agresivo, solo un tope razonable
          // para que no pese de más si suben algo gigante.
          transformation: [{ width: 800, height: 800, crop: 'limit' }],
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    await pool.query(
      'INSERT INTO config_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
      ['logo_url', resultado.secure_url, resultado.secure_url]
    );

    res.status(201).json({ logo_url: resultado.secure_url });
  } catch (err) {
    console.error('Error subiendo logo a Cloudinary:', err.message);
    res.status(502).json({ error: 'No se pudo subir el logo. Probá de nuevo.' });
  }
});

// Multer tira sus errores (tamaño, formato) distinto al resto de Express;
// los capturamos acá para responder con el mismo formato de error JSON.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('Formato no soportado')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
