const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

/**
 * GET /api/vehiculos
 * Lista pública de vehículos activos, con su imagen de portada.
 * Query opcional: ?categoria=suv|pasajeros|comercial
 */
router.get('/', async (req, res) => {
  const { categoria } = req.query;

  let sql = `
    SELECT
      v.id, v.slug, v.nombre, v.version, v.plan_nombre, v.plan_detalle,
      v.valor_movil, v.cuota_1, v.cuota_desde, v.cantidad_cuotas,
      v.categoria, v.destacado, v.descripcion,
      img.url AS portada_url
    FROM vehiculos v
    LEFT JOIN vehiculo_imagenes img
      ON img.vehiculo_id = v.id AND img.es_portada = 1
    WHERE v.activo = 1
  `;
  const params = [];

  if (categoria && ['pasajeros', 'suv', 'comercial'].includes(categoria)) {
    sql += ' AND v.categoria = ?';
    params.push(categoria);
  }

  sql += ' ORDER BY v.destacado DESC, v.orden ASC, v.id ASC';

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

/**
 * GET /api/vehiculos/:slug
 * Detalle público de un vehículo, con todas sus fotos.
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  const [vehiculos] = await pool.query(
    'SELECT * FROM vehiculos WHERE slug = ? AND activo = 1',
    [slug]
  );

  if (vehiculos.length === 0) {
    return res.status(404).json({ error: 'Vehículo no encontrado' });
  }

  const vehiculo = vehiculos[0];

  const [imagenes] = await pool.query(
    'SELECT id, url, es_portada, orden FROM vehiculo_imagenes WHERE vehiculo_id = ? ORDER BY es_portada DESC, orden ASC',
    [vehiculo.id]
  );

  res.json({ ...vehiculo, imagenes });
});

module.exports = router;
