const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de conexiones. Usa DATABASE_URL si está disponible (Railway la provee
// automáticamente); si no, arma la conexión desde variables sueltas para
// desarrollo local.
const pool = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'peugeot_plan',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✓ Conexión a MySQL establecida');
    conn.release();
  } catch (err) {
    console.error('✗ Error conectando a MySQL:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
