const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/db');
const authRoutes = require('./routes/auth');
const vehiculosPublicRoutes = require('./routes/vehiculosPublic');
const vehiculosAdminRoutes = require('./routes/vehiculosAdmin');
const consultasRoutes = require('./routes/consultas');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 4000;

// Railway (y la mayoría de los PaaS) ponen la app detrás de un único
// proxy propio, que agrega el header X-Forwarded-For con la IP real del
// visitante. Sin esto, express-rate-limit rechaza cada petición porque
// no puede confiar en ese header. El valor 1 (no `true`) le dice a
// Express que confíe solo en ese primer proxy inmediato — no en toda
// una cadena arbitraria — que es lo correcto para este tipo de hosting.
app.set('trust proxy', 1);

// Chequeo de env vars críticas al arrancar, para fallar rápido y claro
// en vez de un error críptico en el primer request.
const REQUIRED_ENV = ['JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const faltantes = REQUIRED_ENV.filter((key) => !process.env[key]);
if (faltantes.length > 0) {
  console.error(`✗ Faltan variables de entorno: ${faltantes.join(', ')}`);
  process.exit(1);
}

app.use(helmet());

// CORS: en producción, restringir a los dominios del frontend.
// FRONTEND_URL puede ser una lista separada por comas (landing + www, por ejemplo).
const origenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());
app.use(
  cors({
    origin: origenesPermitidos,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

// Rate limit general de la API, además de los específicos en login/consultas.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/vehiculos', vehiculosPublicRoutes);
app.use('/api/admin/vehiculos', vehiculosAdminRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/config', configRoutes);

// Manejador de errores genérico al final de todo.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`✓ Servidor corriendo en puerto ${PORT}`);
  });
}

start();
