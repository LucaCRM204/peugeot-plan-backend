/**
 * Crea las tablas necesarias si no existen. Corré `npm run migrate` una vez
 * después de configurar las variables de entorno (o Railway lo puede correr
 * como parte del deploy).
 */
const { pool } = require('./db');

const CREATE_ADMINS = `
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CREATE_VEHICULOS = `
CREATE TABLE IF NOT EXISTS vehiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  nombre VARCHAR(191) NOT NULL,
  version VARCHAR(191) DEFAULT NULL,
  plan_nombre VARCHAR(191) DEFAULT NULL,
  plan_detalle VARCHAR(255) DEFAULT NULL,
  codigo_modelo VARCHAR(50) DEFAULT NULL,
  valor_movil DECIMAL(14,2) NOT NULL,
  cuota_1 DECIMAL(14,2) NOT NULL,
  cuota_desde DECIMAL(14,2) DEFAULT NULL,
  cantidad_cuotas INT DEFAULT 84,
  categoria ENUM('pasajeros','suv','comercial') NOT NULL DEFAULT 'pasajeros',
  destacado TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  descripcion TEXT DEFAULT NULL,
  vigente_desde DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CREATE_VEHICULO_IMAGENES = `
CREATE TABLE IF NOT EXISTS vehiculo_imagenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id INT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  es_portada TINYINT(1) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CREATE_CONSULTAS = `
CREATE TABLE IF NOT EXISTS consultas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id INT DEFAULT NULL,
  nombre VARCHAR(191) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  email VARCHAR(191) DEFAULT NULL,
  mensaje TEXT DEFAULT NULL,
  origen VARCHAR(50) DEFAULT 'formulario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CREATE_CONFIG_SITIO = `
CREATE TABLE IF NOT EXISTS config_sitio (
  clave VARCHAR(100) PRIMARY KEY,
  valor TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function migrate() {
  console.log('Corriendo migraciones...');
  await pool.query(CREATE_ADMINS);
  console.log('✓ admins');
  await pool.query(CREATE_VEHICULOS);
  console.log('✓ vehiculos');
  await pool.query(CREATE_VEHICULO_IMAGENES);
  console.log('✓ vehiculo_imagenes');
  await pool.query(CREATE_CONSULTAS);
  console.log('✓ consultas');
  await pool.query(CREATE_CONFIG_SITIO);
  console.log('✓ config_sitio');
  console.log('Listo.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
