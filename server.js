require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initialize } = require('./database');
const apiRoutes = require('./routes/api');
const { startAutomationCron } = require('./automationCron');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar base de datos
initialize();

// Iniciar motor de recordatorios automáticos por WhatsApp
startAutomationCron();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`💈 S Barber Web App Activa`);
  console.log(`🌐 Web Pública: http://localhost:${PORT}`);
  console.log(`📋 Panel Admin: http://localhost:${PORT}/admin`);
  console.log(`💬 Recordatorios WhatsApp: Automatizados (Cron cada 5 min)`);
  console.log(`==================================================\n`);
});
