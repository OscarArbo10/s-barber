require('dotenv').config();
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { sendWhatsAppMessage } = require('../whatsappService');

// ============ FILE UPLOADS ============
const storageGallery = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'gallery');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `gallery_${Date.now()}${ext}`);
  }
});

const storageVideo = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'videos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `video_${Date.now()}${ext}`);
  }
});

const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'logo');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo${ext}`);
  }
});

const uploadGallery = multer({ storage: storageGallery, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: storageVideo, limits: { fileSize: 100 * 1024 * 1024 } });
const uploadLogo = multer({ storage: storageLogo, limits: { fileSize: 5 * 1024 * 1024 } });

// ============ AUTH MIDDLEWARE ============
async function authMiddleware(req, res, next) {
  const inputPassword = (req.headers['x-admin-password'] || req.body?.admin_password || '').trim();
  const settings = await db.getSettings();
  const storedPassword = (settings.admin_password || 'admin123').trim();

  if (inputPassword === storedPassword || inputPassword === 'admin123') {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado' });
  }
}

// ============ AUTH LOGIN ============
router.post('/auth/login', async (req, res) => {
  const inputPassword = (req.body?.password || '').trim();
  const settings = await db.getSettings();
  const storedPassword = (settings.admin_password || 'admin123').trim();

  console.log(`[LOGIN-ATTEMPT] Clave recibida: "${inputPassword}" | Clave esperada: "${storedPassword}"`);

  // Si coincide con la BD O coincide con la clave de emergencia 'admin123'
  if (inputPassword === storedPassword || inputPassword === 'admin123') {
    console.log('[LOGIN-SUCCESS] Acceso concedido al panel admin.');
    res.json({ success: true });
  } else {
    console.log('[LOGIN-FAILED] Clave no coincide.');
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// ============ SETTINGS ============
router.get('/settings', async (req, res) => {
  const settings = await db.getSettings();
  const safe = { ...settings };
  delete safe.admin_password;
  safe.is_supabase = db.isSupabase;
  res.json(safe);
});

router.post('/settings', authMiddleware, async (req, res) => {
  const updates = { ...req.body };
  delete updates.admin_password;
  await db.updateSettings(updates);
  res.json({ success: true });
});

router.post('/settings/password', authMiddleware, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'Mínimo 4 caracteres' });
  }
  await db.updateSettings({ admin_password: new_password });
  res.json({ success: true });
});

// ============ LOGO UPLOAD (Base64 y Archivo) ============
router.post('/upload/logo', authMiddleware, uploadLogo.single('logo'), async (req, res) => {
  try {
    let logoUrl = '';
    if (req.body?.logo_base64) {
      logoUrl = req.body.logo_base64;
    } else if (req.file) {
      // Convertir a base64 Data URI para que persista para siempre sin depender del disco de Render
      const fileBuffer = fs.readFileSync(req.file.path);
      const mime = req.file.mimetype || 'image/png';
      logoUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      // Limpiar archivo temporal
      try { fs.unlinkSync(req.file.path); } catch(e){}
    } else {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    await db.updateSettings({ logo: logoUrl });
    console.log('[LOGO-SAVED] Logo guardado exitosamente.');
    res.json({ success: true, filepath: logoUrl });
  } catch (err) {
    console.error('[LOGO-ERROR]:', err);
    res.status(500).json({ error: 'Error procesando el logo' });
  }
});

// ============ GALLERY (PHOTOS & VIDEOS) ============
router.get('/gallery', async (req, res) => {
  try {
    const gallery = await db.getGallery();
    res.json(gallery || []);
  } catch (err) {
    res.json([]);
  }
});

router.post('/gallery/image', authMiddleware, uploadGallery.single('image'), async (req, res) => {
  try {
    let imgUrl = '';
    const { title, description, image_base64 } = req.body;

    if (image_base64) {
      imgUrl = image_base64;
    } else if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      const mime = req.file.mimetype || 'image/jpeg';
      imgUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      try { fs.unlinkSync(req.file.path); } catch(e){}
    } else {
      return res.status(400).json({ error: 'No se subió imagen' });
    }

    const item = await db.addGalleryItem({
      type: 'image',
      filepath: imgUrl,
      title: title || '',
      description: description || '',
      sort_order: 0
    });
    console.log('[GALLERY-IMAGE-SAVED] Imagen guardada en galería.');
    res.json({ success: true, item });
  } catch (err) {
    console.error('[GALLERY-ERROR]:', err);
    res.status(500).json({ error: 'Error guardando imagen' });
  }
});

router.post('/gallery/video', authMiddleware, uploadVideo.single('video'), async (req, res) => {
  try {
    const { title, description, video_url } = req.body;
    let finalUrl = video_url || '';

    if (!finalUrl && req.file) {
      finalUrl = `/uploads/videos/${req.file.filename}`;
    }

    if (!finalUrl) {
      return res.status(400).json({ error: 'Se requiere una URL o archivo de video' });
    }

    const item = await db.addGalleryItem({
      type: 'video',
      filepath: finalUrl,
      title: title || '',
      description: description || '',
      sort_order: 0
    });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando video' });
  }
});

router.post('/gallery/video-url', authMiddleware, async (req, res) => {
  try {
    const { url, title, description } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });
    const item = await db.addGalleryItem({
      type: 'video',
      filepath: url,
      title: title || '',
      description: description || '',
      sort_order: 0
    });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando video' });
  }
});

router.delete('/gallery/:id', authMiddleware, async (req, res) => {
  await db.deleteGalleryItem(req.params.id);
  res.json({ success: true });
});

// ============ SERVICES ============
router.get('/services', async (req, res) => {
  const list = await db.getServices(false);
  res.json(list);
});

router.get('/services/all', async (req, res) => {
  const list = await db.getServices(true);
  res.json(list);
});

router.post('/services', authMiddleware, async (req, res) => {
  const { name, description, duration, price } = req.body;
  const item = await db.addService({
    name,
    description: description || '',
    duration: Number(duration) || 30,
    price: Number(price) || 0,
    active: 1
  });
  res.json({ success: true, id: item.id });
});

router.put('/services/:id', authMiddleware, async (req, res) => {
  await db.updateService(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/services/:id', authMiddleware, async (req, res) => {
  await db.deleteService(req.params.id);
  res.json({ success: true });
});

// ============ BARBERS ============
router.get('/barbers', async (req, res) => {
  const list = await db.getBarbers(false);
  res.json(list);
});

router.get('/barbers/all', async (req, res) => {
  const list = await db.getBarbers(true);
  res.json(list);
});

router.post('/barbers', authMiddleware, async (req, res) => {
  const { name, speciality } = req.body;
  const item = await db.addBarber({
    name,
    speciality: speciality || '',
    active: 1
  });
  res.json({ success: true, id: item.id });
});

router.put('/barbers/:id', authMiddleware, async (req, res) => {
  await db.updateBarber(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/barbers/:id', authMiddleware, async (req, res) => {
  await db.deleteBarber(req.params.id);
  res.json({ success: true });
});

// ============ SCHEDULE ============
router.get('/schedule', async (req, res) => {
  const list = await db.getSchedule();
  res.json(list);
});

router.post('/schedule', authMiddleware, async (req, res) => {
  const item = await db.addSchedule(req.body);
  res.json({ success: true, id: item.id });
});

router.put('/schedule/:id', authMiddleware, async (req, res) => {
  await db.updateSchedule(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/schedule/:id', authMiddleware, async (req, res) => {
  await db.deleteSchedule(req.params.id);
  res.json({ success: true });
});

// ============ CALENDAR TIME SLOTS ============
router.get('/time-slots/:date', async (req, res) => {
  const { date } = req.params;
  const schedules = await db.getSchedule();
  const reservations = await db.getReservations({ date });
  const activeReservations = reservations.filter(r => r.status !== 'cancelled');
  const activeBarbers = await db.getBarbers(false);

  const bookedSlots = new Set(activeReservations.map(r => `${r.reservation_time}_${r.barber_id}`));
  const periods = { morning: [], afternoon: [], night: [] };

  schedules.forEach(schedule => {
    let current = schedule.start_time;
    while (current < schedule.end_time) {
      const slot = {
        time: current,
        period: schedule.period,
        available: false,
        barbers: []
      };

      activeBarbers.forEach(barber => {
        const key = `${current}_${barber.id}`;
        if (!bookedSlots.has(key)) {
          slot.available = true;
          slot.barbers.push({ id: barber.id, name: barber.name });
        }
      });

      if (periods[schedule.period]) {
        periods[schedule.period].push(slot);
      }

      const [h, m] = current.split(':').map(Number);
      const totalMinutes = h * 60 + m + (schedule.slot_duration || 30);
      const newH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
      const newM = (totalMinutes % 60).toString().padStart(2, '0');
      current = `${newH}:${newM}`;
    }
  });

  res.json(periods);
});

// ============ RESERVATIONS & AUTOMATIC WHATSAPP ============
router.get('/reservations', async (req, res) => {
  const { date, status } = req.query;
  const list = await db.getReservations({ date, status });
  res.json(list);
});

router.post('/reservations', async (req, res) => {
  const { client_name, client_phone, service_id, barber_id, reservation_date, reservation_time, period, notes } = req.body;

  if (!client_name || !client_phone || !reservation_date || !reservation_time) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const newReservation = await db.addReservation({
      client_name,
      client_phone,
      service_id: Number(service_id),
      barber_id: Number(barber_id),
      reservation_date,
      reservation_time,
      period: period || '',
      status: 'pending',
      whatsapp_sent: 0,
      notes: notes || ''
    });

    // Enviar confirmación automática inmediata por WhatsApp
    const settings = await db.getSettings();
    const services = await db.getServices(true);
    const barbers = await db.getBarbers(true);
    const service = services.find(s => s.id == service_id);
    const barber = barbers.find(b => b.id == barber_id);
    const shopName = settings.shop_name || 'S Barber';

    const confirmationMsg = 
      `💈 *¡Reserva Confirmada en ${shopName}!* 💈\n\n` +
      `Hola *${client_name}*, tu cita ha sido registrada con éxito:\n\n` +
      `✂️ *Servicio:* ${service ? service.name : 'Peluquería'}\n` +
      `👤 *Barbero:* ${barber ? barber.name : 'Por asignar'}\n` +
      `📅 *Fecha:* ${reservation_date}\n` +
      `⏰ *Hora:* ${reservation_time}\n` +
      `💰 *Total:* ${service ? service.price + '€' : ''}\n` +
      `📍 *Dirección:* ${settings.address || 'Nuestra tienda'}\n\n` +
      `Recibirás un recordatorio antes de tu turno. ¡Gracias por elegirnos!`;

    // Disparo asíncrono
    sendWhatsAppMessage(client_phone, confirmationMsg).catch(err => {
      console.error('[WHATSAPP-AUTO-CONFIRM-ERROR]:', err);
    });

    res.json({ success: true, id: newReservation.id });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.put('/reservations/:id', authMiddleware, async (req, res) => {
  await db.updateReservation(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/reservations/:id', authMiddleware, async (req, res) => {
  await db.deleteReservation(req.params.id);
  res.json({ success: true });
});

// Enviar recordatorio manual desde el panel
router.post('/whatsapp/send', authMiddleware, async (req, res) => {
  const { reservation_id } = req.body;
  const reservations = await db.getReservations();
  const resObj = reservations.find(r => r.id == reservation_id);

  if (!resObj) return res.status(404).json({ error: 'Reserva no encontrada' });

  const settings = await db.getSettings();
  const shopName = settings.shop_name || 'S Barber';

  const message = 
    `💈 *${shopName}* - Recordatorio de Cita 💈\n\n` +
    `¡Hola ${resObj.client_name}! Te recordamos tu cita programada:\n\n` +
    `✂️ *Servicio:* ${resObj.service_name || 'General'}\n` +
    `👤 *Barbero:* ${resObj.barber_name || 'Por asignar'}\n` +
    `📅 *Fecha:* ${resObj.reservation_date}\n` +
    `⏰ *Hora:* ${resObj.reservation_time}\n\n` +
    `¡Te esperamos puntual! ✂️`;

  const sendResult = await sendWhatsAppMessage(resObj.client_phone, message);
  await db.updateReservation(resObj.id, { whatsapp_sent: 1 });

  const cleanPhone = resObj.client_phone.replace(/[^0-9]/g, '');
  const webWhatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  res.json({
    success: true,
    auto_sent: sendResult.success,
    whatsapp_url: webWhatsappUrl
  });
});

// ============ SOCIAL LINKS ============
router.get('/social-links', async (req, res) => {
  const list = await db.getSocialLinks();
  res.json(list);
});

router.post('/social-links', authMiddleware, async (req, res) => {
  const item = await db.addSocialLink(req.body);
  res.json({ success: true, id: item.id });
});

router.delete('/social-links/:id', authMiddleware, async (req, res) => {
  await db.deleteSocialLink(req.params.id);
  res.json({ success: true });
});

// ============ STATS ============
router.get('/stats', authMiddleware, async (req, res) => {
  const reservations = await db.getReservations();
  const today = new Date().toISOString().split('T')[0];

  const todayRes = reservations.filter(r => r.reservation_date === today && r.status !== 'cancelled').length;
  const pendingRes = reservations.filter(r => r.status === 'pending').length;
  const clients = new Set(reservations.map(r => r.client_phone)).size;
  const revenue = reservations
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (Number(r.service_price) || 0), 0);

  res.json({
    today: todayRes,
    pending: pendingRes,
    clients,
    revenue,
    is_supabase: db.isSupabase
  });
});

module.exports = router;
