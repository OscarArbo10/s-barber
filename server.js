require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initialize } = require('./database');
const apiRoutes = require('./routes/api');
const { startAutomationCron } = require('./automationCron');

const app = express();
// Proteger el proceso contra excepciones no capturadas para que Node.js 24 no se caiga
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Inicializar base de datos
initialize();

// Iniciar motor de recordatorios automáticos por WhatsApp
try {
  startAutomationCron();
} catch (e) {
  console.error('Error al iniciar cron:', e);
}

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck para Render
app.get('/health', (req, res) => res.status(200).send('OK'));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Rutas de API
app.use('/api', apiRoutes);

// Vistas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`\n==================================================`);
  console.log(`💈 S Barber Web App Activa`);
  console.log(`🌐 Escuchando en: http://${HOST}:${PORT}`);
  console.log(`==================================================\n`);
});
