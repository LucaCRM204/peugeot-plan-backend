const express = require('express');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// Todas las rutas de este archivo requieren estar logueado.
router.use(requireAuth);

// Multer en memoria: el archivo pasa directo a Cloudinary sin tocar disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por imagen
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Usá JPG, PNG o WEBP.'));
    }
  },
});

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const vehiculoValidations = [
  body('nombre').isString().trim().isLength({ min: 1, max: 191 }),
  body('version').optional({ nullable: true }).isString().trim().isLength({ max: 191 }),
  body('plan_nombre').optional({ nullable: true }).isString().trim().isLength({ max: 191 }),
  body('plan_detalle').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('codigo_modelo').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('valor_movil').isFloat({ min: 0 }),
  body('cuota_1').isFloat({ min: 0 }),
  body('cuota_desde').optional({ nullable: true }).isFloat({ min: 0 }),
  body('cantidad_cuotas').optional().isInt({ min: 1, max: 999 }),
  body('categoria').isIn(['pasajeros', 'suv', 'comercial']),
  body('destacado').optional().isBoolean(),
  body('activo').optional().isBoolean(),
  body('descripcion').optional({ nullable: true }).isString().trim(),
];

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Datos inválidos', detalles: errors.array() });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/vehiculos
 * Lista completa (incluye inactivos) para el panel.
 */
router.get('/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      v.*,
      img.url AS portada_url,
      (SELECT COUNT(*) FROM vehiculo_imagenes vi WHERE vi.vehiculo_id = v.id) AS cantidad_fotos
    FROM vehiculos v
    LEFT JOIN vehiculo_imagenes img
      ON img.vehiculo_id = v.id AND img.es_portada = 1
    ORDER BY v.orden ASC, v.id ASC
  `);
  res.json(rows);
});

/**
 * GET /api/admin/vehiculos/:id
 * Detalle completo incluyendo imágenes, para editar.
 */
router.get('/:id', param('id').isInt(), async (req, res) => {
  if (!checkValidation(req, res)) return;

  const [vehiculos] = await pool.query('SELECT * FROM vehiculos WHERE id = ?', [req.params.id]);
  if (vehiculos.length === 0) {
    return res.status(404).json({ error: 'Vehículo no encontrado' });
  }

  const [imagenes] = await pool.query(
    'SELECT * FROM vehiculo_imagenes WHERE vehiculo_id = ? ORDER BY es_portada DESC, orden ASC',
    [req.params.id]
  );

  res.json({ ...vehiculos[0], imagenes });
});

/**
 * POST /api/admin/vehiculos
 * Crea un vehículo nuevo. El slug se genera automáticamente del nombre
 * + versión + plan, y si ya existe le agrega un sufijo numérico.
 */
router.post('/', vehiculoValidations, async (req, res) => {
  if (!checkValidation(req, res)) return;

  const {
    nombre, version, plan_nombre, plan_detalle, codigo_modelo,
    valor_movil, cuota_1, cuota_desde, cantidad_cuotas,
    categoria, destacado, descripcion,
  } = req.body;

  const base = slugify([nombre, version, plan_nombre].filter(Boolean).join('-'));
  let slug = base;
  let intento = 1;
  // Evita colisiones de slug sin fallar la petición.
  while (true) {
    const [existe] = await pool.query('SELECT id FROM vehiculos WHERE slug = ?', [slug]);
    if (existe.length === 0) break;
    intento += 1;
    slug = `${base}-${intento}`;
  }

  const [result] = await pool.query(
    `INSERT INTO vehiculos
      (slug, nombre, version, plan_nombre, plan_detalle, codigo_modelo, valor_movil, cuota_1, cuota_desde, cantidad_cuotas, categoria, destacado, descripcion, vigente_desde)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      slug, nombre, version || null, plan_nombre || null, plan_detalle || null,
      codigo_modelo || null, valor_movil, cuota_1, cuota_desde || null,
      cantidad_cuotas || 84, categoria, destacado ? 1 : 0, descripcion || null,
    ]
  );

  const [nuevo] = await pool.query('SELECT * FROM vehiculos WHERE id = ?', [result.insertId]);
  res.status(201).json(nuevo[0]);
});

/**
 * PUT /api/admin/vehiculos/:id
 * Edita un vehículo existente (precios, datos, estado). No toca el slug
 * ni las imágenes — eso es a propósito, para no romper enlaces ya
 * compartidos por WhatsApp cuando alguien solo actualiza un precio.
 */
router.put('/:id', [param('id').isInt(), ...vehiculoValidations], async (req, res) => {
  if (!checkValidation(req, res)) return;

  const [existe] = await pool.query('SELECT id FROM vehiculos WHERE id = ?', [req.params.id]);
  if (existe.length === 0) {
    return res.status(404).json({ error: 'Vehículo no encontrado' });
  }

  const {
    nombre, version, plan_nombre, plan_detalle, codigo_modelo,
    valor_movil, cuota_1, cuota_desde, cantidad_cuotas,
    categoria, destacado, activo, descripcion,
  } = req.body;

  await pool.query(
    `UPDATE vehiculos SET
      nombre = ?, version = ?, plan_nombre = ?, plan_detalle = ?, codigo_modelo = ?,
      valor_movil = ?, cuota_1 = ?, cuota_desde = ?, cantidad_cuotas = ?,
      categoria = ?, destacado = ?, activo = ?, descripcion = ?
     WHERE id = ?`,
    [
      nombre, version || null, plan_nombre || null, plan_detalle || null, codigo_modelo || null,
      valor_movil, cuota_1, cuota_desde || null, cantidad_cuotas || 84,
      categoria, destacado ? 1 : 0, activo === undefined ? 1 : (activo ? 1 : 0), descripcion || null,
      req.params.id,
    ]
  );

  const [actualizado] = await pool.query('SELECT * FROM vehiculos WHERE id = ?', [req.params.id]);
  res.json(actualizado[0]);
});

/**
 * PATCH /api/admin/vehiculos/:id/orden
 * Solo actualiza el orden de aparición (drag & drop en el panel).
 */
router.patch(
  '/:id/orden',
  [param('id').isInt(), body('orden').isInt({ min: 0 })],
  async (req, res) => {
    if (!checkValidation(req, res)) return;
    await pool.query('UPDATE vehiculos SET orden = ? WHERE id = ?', [req.body.orden, req.params.id]);
    res.json({ ok: true });
  }
);

/**
 * DELETE /api/admin/vehiculos/:id
 * Borrado real. Las imágenes asociadas se borran en cascada de la tabla
 * (FK ON DELETE CASCADE), pero hay que borrarlas de Cloudinary aparte.
 */
router.delete('/:id', param('id').isInt(), async (req, res) => {
  if (!checkValidation(req, res)) return;

  const [imagenes] = await pool.query(
    'SELECT cloudinary_public_id FROM vehiculo_imagenes WHERE vehiculo_id = ?',
    [req.params.id]
  );

  for (const img of imagenes) {
    try {
      await cloudinary.uploader.destroy(img.cloudinary_public_id);
    } catch (err) {
      console.error('No se pudo borrar de Cloudinary:', img.cloudinary_public_id, err.message);
      // Sigue igual: preferimos borrar el vehículo aunque quede una imagen
      // huérfana en Cloudinary, a bloquear el borrado por eso.
    }
  }

  await pool.query('DELETE FROM vehiculos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/**
 * POST /api/admin/vehiculos/:id/imagenes
 * Sube una o más fotos a Cloudinary y las asocia al vehículo.
 * Form-data, campo "fotos" (múltiple).
 */
router.post(
  '/:id/imagenes',
  param('id').isInt(),
  upload.array('fotos', 10),
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    const [vehiculo] = await pool.query('SELECT id FROM vehiculos WHERE id = ?', [req.params.id]);
    if (vehiculo.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se envió ninguna foto' });
    }

    const [yaTiene] = await pool.query(
      'SELECT COUNT(*) AS total FROM vehiculo_imagenes WHERE vehiculo_id = ?',
      [req.params.id]
    );
    const yaTienePortada = yaTiene[0].total > 0;

    const subidas = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        const resultado = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'peugeot-plan/vehiculos',
              transformation: [{ width: 1600, height: 1200, crop: 'limit', quality: 'auto' }],
            },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(file.buffer);
        });

        const esPrimera = !yaTienePortada && i === 0;

        const [insertResult] = await pool.query(
          'INSERT INTO vehiculo_imagenes (vehiculo_id, cloudinary_public_id, url, es_portada, orden) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, resultado.public_id, resultado.secure_url, esPrimera ? 1 : 0, i]
        );

        subidas.push({
          id: insertResult.insertId,
          url: resultado.secure_url,
          es_portada: esPrimera,
        });
      } catch (err) {
        console.error('Error subiendo imagen a Cloudinary:', err.message);
        // Sigue con las demás fotos del lote aunque una falle.
      }
    }

    if (subidas.length === 0) {
      return res.status(502).json({ error: 'No se pudo subir ninguna imagen. Probá de nuevo.' });
    }

    res.status(201).json({ subidas, fallidas: req.files.length - subidas.length });
  }
);

/**
 * PATCH /api/admin/vehiculos/imagenes/:imagenId/portada
 * Marca una imagen como portada (y desmarca las demás del mismo vehículo).
 */
router.patch('/imagenes/:imagenId/portada', param('imagenId').isInt(), async (req, res) => {
  if (!checkValidation(req, res)) return;

  const [imagenes] = await pool.query('SELECT vehiculo_id FROM vehiculo_imagenes WHERE id = ?', [
    req.params.imagenId,
  ]);
  if (imagenes.length === 0) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  const vehiculoId = imagenes[0].vehiculo_id;

  await pool.query('UPDATE vehiculo_imagenes SET es_portada = 0 WHERE vehiculo_id = ?', [vehiculoId]);
  await pool.query('UPDATE vehiculo_imagenes SET es_portada = 1 WHERE id = ?', [req.params.imagenId]);

  res.json({ ok: true });
});

/**
 * DELETE /api/admin/vehiculos/imagenes/:imagenId
 * Borra una imagen puntual (de Cloudinary y de la base).
 */
router.delete('/imagenes/:imagenId', param('imagenId').isInt(), async (req, res) => {
  if (!checkValidation(req, res)) return;

  const [imagenes] = await pool.query('SELECT * FROM vehiculo_imagenes WHERE id = ?', [
    req.params.imagenId,
  ]);
  if (imagenes.length === 0) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  const imagen = imagenes[0];

  try {
    await cloudinary.uploader.destroy(imagen.cloudinary_public_id);
  } catch (err) {
    console.error('No se pudo borrar de Cloudinary:', err.message);
  }

  await pool.query('DELETE FROM vehiculo_imagenes WHERE id = ?', [req.params.imagenId]);

  // Si borramos la portada y quedan más fotos, promovemos la primera que quede.
  if (imagen.es_portada) {
    const [restantes] = await pool.query(
      'SELECT id FROM vehiculo_imagenes WHERE vehiculo_id = ? ORDER BY orden ASC LIMIT 1',
      [imagen.vehiculo_id]
    );
    if (restantes.length > 0) {
      await pool.query('UPDATE vehiculo_imagenes SET es_portada = 1 WHERE id = ?', [restantes[0].id]);
    }
  }

  res.json({ ok: true });
});

// Multer tira sus errores (tamaño, formato) de forma distinta al resto;
// los capturamos acá para responder con el mismo formato de error JSON.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('Formato no soportado')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
