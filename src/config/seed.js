/**
 * Carga inicial de datos: usuario admin + vehículos extraídos de la grilla
 * GOLD_PLAN_GRILLAS_10_DE_AGOSTO_2026.xlsx (hoja Peugeot).
 *
 * Corré esto UNA sola vez después de `npm run migrate`, con:
 *   npm run seed
 *
 * Los precios acá son los vigentes al 10/08/2026. Para actualizarlos más
 * adelante, usá el panel admin — no vuelvas a correr este script, porque
 * fallará si el slug ya existe (a propósito, para no duplicar ni pisar
 * ediciones hechas desde el panel).
 */
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@peugeotplan.com.ar';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD; // obligatorio, sin default
const ADMIN_NOMBRE = process.env.SEED_ADMIN_NOMBRE || 'Admin';

const VEHICULOS = [
  {
    slug: '208-allure-mt-easy',
    nombre: '208 Allure',
    version: 'MT',
    plan_nombre: 'Plan Easy 70/30',
    plan_detalle: '120 cuotas · Caja manual',
    codigo_modelo: '405',
    valor_movil: 40370000,
    cuota_1: 807400,
    cuota_desde: 235491.67, // cuota pura, la más baja del plan
    cantidad_cuotas: 120,
    categoria: 'pasajeros',
    destacado: 1,
    orden: 1,
  },
  {
    slug: '208-allure-mt-plus',
    nombre: '208 Allure',
    version: 'MT',
    plan_nombre: 'Plan Plus 80/20',
    plan_detalle: '84 cuotas · Caja manual · 100% financiado',
    codigo_modelo: '400',
    valor_movil: 40370000,
    cuota_1: 807400,
    cuota_desde: 384476.19,
    cantidad_cuotas: 84,
    categoria: 'pasajeros',
    destacado: 0,
    orden: 2,
  },
  {
    slug: '208-allure-at',
    nombre: '208 Allure',
    version: 'AT',
    plan_nombre: 'Plan Plus AT 100%',
    plan_detalle: '84 cuotas · Caja automática',
    codigo_modelo: '406',
    valor_movil: 42450000,
    cuota_1: 849000,
    cuota_desde: 505357.14,
    cantidad_cuotas: 84,
    categoria: 'pasajeros',
    destacado: 0,
    orden: 3,
  },
  {
    slug: '2008-active',
    nombre: '2008 Active',
    version: null,
    plan_nombre: 'Plan 2008 80/20',
    plan_detalle: '84 cuotas',
    codigo_modelo: '403',
    valor_movil: 49640000,
    cuota_1: 992800,
    cuota_desde: 472761.90,
    cantidad_cuotas: 84,
    categoria: 'suv',
    destacado: 1,
    orden: 4,
  },
  {
    slug: '2008-allure-t200-am25',
    nombre: '2008 Allure',
    version: 'T200 AM25',
    plan_nombre: 'Plan 100%',
    plan_detalle: '84 cuotas · 100% financiado',
    codigo_modelo: null,
    valor_movil: 53840000,
    cuota_1: 1076800,
    cuota_desde: 640952.38,
    cantidad_cuotas: 84,
    categoria: 'suv',
    destacado: 1,
    orden: 5,
  },
  {
    slug: 'partner-confort-hdi',
    nombre: 'Partner Confort',
    version: '1.6 HDI 92 AM22.5',
    plan_nombre: 'Plan 70/30',
    plan_detalle: '84 cuotas',
    codigo_modelo: '398',
    valor_movil: 41820000,
    cuota_1: 836400,
    cuota_desde: 348500,
    cantidad_cuotas: 84,
    categoria: 'comercial',
    destacado: 0,
    orden: 6,
  },
  {
    slug: 'expert-l3-hdi-120',
    nombre: 'Expert L3',
    version: 'HDI 120 AM25',
    plan_nombre: 'Plan 70/30',
    plan_detalle: '84 cuotas',
    codigo_modelo: '399',
    valor_movil: 58650000,
    cuota_1: 1173000,
    cuota_desde: 488750,
    cantidad_cuotas: 84,
    categoria: 'comercial',
    destacado: 0,
    orden: 7,
  },
];

const CONFIG_INICIAL = [
  ['whatsapp_numero', ''], // completar en el panel admin
  ['whatsapp_mensaje_default', 'Hola! Quiero info sobre planes de ahorro Peugeot'],
  ['telefono_contacto', ''],
  ['horario_atencion', 'Lun a Sáb — 09:30 a 19:00hs'],
  ['instagram_usuario', ''],
  ['direccion', ''],
  ['nombre_agencia', 'Peugeot Auto del Sol'],
];

async function seed() {
  if (!ADMIN_PASSWORD) {
    console.error(
      '✗ Falta SEED_ADMIN_PASSWORD en las variables de entorno. ' +
        'Definila antes de correr el seed (no hay contraseña por defecto a propósito).'
    );
    process.exit(1);
  }

  console.log('Cargando datos iniciales...');

  // Admin
  const [existingAdmin] = await pool.query('SELECT id FROM admins WHERE email = ?', [ADMIN_EMAIL]);
  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query('INSERT INTO admins (email, password_hash, nombre) VALUES (?, ?, ?)', [
      ADMIN_EMAIL,
      hash,
      ADMIN_NOMBRE,
    ]);
    console.log(`✓ Admin creado: ${ADMIN_EMAIL}`);
  } else {
    console.log(`- Admin ya existe: ${ADMIN_EMAIL} (no se modificó)`);
  }

  // Vehículos
  for (const v of VEHICULOS) {
    const [existing] = await pool.query('SELECT id FROM vehiculos WHERE slug = ?', [v.slug]);
    if (existing.length > 0) {
      console.log(`- Ya existe, se salteó: ${v.slug}`);
      continue;
    }
    await pool.query(
      `INSERT INTO vehiculos
        (slug, nombre, version, plan_nombre, plan_detalle, codigo_modelo, valor_movil, cuota_1, cuota_desde, cantidad_cuotas, categoria, destacado, orden, vigente_desde)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.slug,
        v.nombre,
        v.version,
        v.plan_nombre,
        v.plan_detalle,
        v.codigo_modelo,
        v.valor_movil,
        v.cuota_1,
        v.cuota_desde,
        v.cantidad_cuotas,
        v.categoria,
        v.destacado,
        v.orden,
        '2026-08-10',
      ]
    );
    console.log(`✓ Vehículo cargado: ${v.nombre} ${v.version || ''} (${v.plan_nombre})`);
  }

  // Config del sitio
  for (const [clave, valor] of CONFIG_INICIAL) {
    await pool.query(
      'INSERT INTO config_sitio (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE clave = clave',
      [clave, valor]
    );
  }
  console.log('✓ Config inicial del sitio cargada (completá whatsapp_numero, telefono_contacto, etc. desde el panel admin)');

  console.log('Listo.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
