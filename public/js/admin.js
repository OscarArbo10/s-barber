// ============ S BARBER - ADMIN JS ============

let adminPassword = sessionStorage.getItem('sbarber_admin_token') || '';

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  // Permitir login con la tecla Enter en el input
  const inputEl = document.getElementById('admin-pass-input');
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  if (adminPassword) {
    checkAuthAndInit();
  }
});

// ============ API FETCH HELPER ============
// Si estamos en Netlify u otro dominio externo, usamos el backend de Render; si estamos en localhost, ruta relativa.
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'https://s-barber.onrender.com';

// ============ AUTH ============
async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const inputEl = document.getElementById('admin-pass-input');
  const input = inputEl ? inputEl.value.trim() : '';
  const btn = document.querySelector('#login-form button[type="submit"]');
  const originalText = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      adminPassword = input;
      sessionStorage.setItem('sbarber_admin_token', adminPassword);
      checkAuthAndInit();
    } else {
      document.getElementById('login-error').textContent = data.error || 'Contraseña incorrecta';
      document.getElementById('login-error').style.display = 'block';
    }
  } catch (err) {
    console.error('Error de login:', err);
    document.getElementById('login-error').textContent = 'Error de conexión con el servidor. Revisa tu backend en Render.';
    document.getElementById('login-error').style.display = 'block';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

async function checkAuthAndInit() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-layout').classList.add('active');

  // Ejecutar de forma segura con try/catch para que un fallo en un módulo no bloquee los demás
  try { await loadDashboardStats(); } catch(e){ console.error('Stats:', e); }
  try { await loadReservations(); } catch(e){ console.error('Reservations:', e); }
  try { await loadAdminGallery(); } catch(e){ console.error('Gallery:', e); }
  try { await loadAdminServices(); } catch(e){ console.error('Services:', e); }
  try { await loadAdminBarbers(); } catch(e){ console.error('Barbers:', e); }
  try { await loadAdminSchedule(); } catch(e){ console.error('Schedule:', e); }
  try { await loadAdminSocial(); } catch(e){ console.error('Social:', e); }
  try { await loadAdminSettings(); } catch(e){ console.error('Settings:', e); }
}

function logout() {
  sessionStorage.removeItem('sbarber_admin_token');
  window.location.reload();
}

// ============ API FETCH HELPER ============
async function adminApi(endpoint, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  // Enviar contraseña de admin en header x-admin-password
  headers['x-admin-password'] = adminPassword;

  console.log(`[API REQUEST] Enviando ${options.method || 'GET'} a ${API_BASE}/api${endpoint}`);

  try {
    const res = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
  } catch (err) {
    console.error(`[API ERROR] en ${endpoint}:`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

// ============ NAVIGATION ============
function showPage(pageId) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) targetPage.classList.add('active');

  const titles = {
    dashboard: 'Dashboard General',
    reservations: 'Gestión de Reservas y WhatsApp',
    gallery: 'Galería: Fotos y Videos',
    services: 'Servicios y Precios',
    barbers: 'Equipo de Barberos',
    schedule: 'Turnos y Horarios (Mañana, Tarde, Noche)',
    social: 'Enlaces de Redes Sociales',
    branding: 'Logo y Datos de Presentación',
    security: 'Seguridad'
  };
  document.getElementById('page-title').textContent = titles[pageId] || 'Administración';

  // Mobile sidebar close
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============ DASHBOARD STATS ============
async function loadDashboardStats() {
  try {
    const stats = await adminApi('/stats');
    document.getElementById('stat-today').textContent = stats.today;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-revenue').textContent = `${stats.revenue}€`;
    document.getElementById('stat-clients').textContent = stats.clients;
  } catch (e) {
    console.error(e);
  }
}

// ============ RESERVATIONS ============
async function loadReservations() {
  const date = document.getElementById('filter-date')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';

  let query = '?';
  if (date) query += `date=${date}&`;
  if (status) query += `status=${status}&`;

  const reservations = await adminApi(`/reservations${query}`);
  const tbody = document.getElementById('reservations-tbody');
  const dashTbody = document.getElementById('dashboard-reservations-tbody');

  const periodLabels = {
    morning: '🌅 Mañana',
    afternoon: '☀️ Tarde',
    night: '🌙 Noche'
  };

  const statusBadges = {
    pending: '<span class="badge badge-pending">Pendiente</span>',
    confirmed: '<span class="badge badge-confirmed">Confirmada</span>',
    completed: '<span class="badge badge-completed">Completada</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelada</span>'
  };

  const rows = reservations.map(r => `
    <tr>
      <td><strong>${r.reservation_date}</strong></td>
      <td>${r.reservation_time} <br><small style="color:var(--medium-gray)">${periodLabels[r.period] || ''}</small></td>
      <td><strong>${r.client_name}</strong></td>
      <td>${r.client_phone}</td>
      <td>${r.service_name || '-'} <br><small>${r.service_price ? r.service_price + '€' : ''}</small></td>
      <td>${r.barber_name || 'Cualquiera'}</td>
      <td>${statusBadges[r.status] || r.status}</td>
      <td>
        <button class="btn btn-sm btn-whatsapp" onclick="sendWhatsAppReminder(${r.id})">
          <i class="fab fa-whatsapp"></i> Recordar
        </button>
      </td>
      <td>
        <div class="actions">
          <select onchange="updateReservationStatus(${r.id}, this.value)" style="padding:4px; font-size:0.8rem; border-radius:4px; border:1px solid var(--light-gray);">
            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pendiente</option>
            <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmar</option>
            <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Completar</option>
            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelar</option>
          </select>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteReservation(${r.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = rows || '<tr><td colspan="9" style="text-align:center; padding: 20px;">No hay reservas que mostrar</td></tr>';

  // Also fill dashboard table (top 5)
  if (dashTbody) {
    const dashRows = reservations.slice(0, 5).map(r => `
      <tr>
        <td>${r.reservation_date} - ${r.reservation_time}</td>
        <td><strong>${r.client_name}</strong> (${r.client_phone})</td>
        <td>${r.service_name || '-'}</td>
        <td>${r.barber_name || 'General'}</td>
        <td>${statusBadges[r.status] || r.status}</td>
        <td>
          <button class="btn btn-sm btn-whatsapp" onclick="sendWhatsAppReminder(${r.id})">
            <i class="fab fa-whatsapp"></i> Enviar
          </button>
        </td>
      </tr>
    `).join('');
    dashTbody.innerHTML = dashRows || '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay reservas recientes</td></tr>';
  }
}

function resetReservationFilters() {
  document.getElementById('filter-date').value = '';
  document.getElementById('filter-status').value = '';
  loadReservations();
}

async function updateReservationStatus(id, newStatus) {
  await adminApi(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
  showToast('Estado actualizado', 'success');
  loadDashboardStats();
}

async function deleteReservation(id) {
  if (!confirm('¿Seguro que deseas eliminar esta reserva?')) return;
  await adminApi(`/reservations/${id}`, { method: 'DELETE' });
  showToast('Reserva eliminada', 'success');
  loadReservations();
  loadDashboardStats();
}

async function sendWhatsAppReminder(id) {
  const res = await adminApi('/whatsapp/send', {
    method: 'POST',
    body: JSON.stringify({ reservation_id: id })
  });
  if (res.whatsapp_url) {
    window.open(res.whatsapp_url, '_blank');
    showToast('Abriendo WhatsApp con el recordatorio...', 'success');
  }
}

// ============ GALLERY (PHOTOS & VIDEOS) ============
async function loadAdminGallery() {
  const gallery = await adminApi('/gallery');
  const container = document.getElementById('admin-gallery-grid');

  if (gallery.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; color: var(--medium-gray); text-align: center; padding: 20px;">No hay elementos en la galería aún.</p>';
    return;
  }

  container.innerHTML = gallery.map(item => {
    let preview = '';
    if (item.type === 'image') {
      preview = `<img src="${resolveMediaUrl(item.filepath)}" alt="${item.title}">`;
    } else {
      if (item.filepath.includes('youtube') || item.filepath.includes('youtu.be')) {
        preview = `<div style="background:#000; color:#fff; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;"><i class="fab fa-youtube" style="font-size:2.5rem; color:red;"></i><small style="margin-top:4px;">YouTube</small></div>`;
      } else {
        preview = `<video src="${resolveMediaUrl(item.filepath)}" muted style="width:100%; height:100%; object-fit:cover;"></video>`;
      }
    }

    return `
      <div class="gallery-admin-item">
        ${preview}
        <div class="item-overlay">
          <p><strong>${item.title || 'Sin título'}</strong> (${item.type === 'image' ? 'Foto' : 'Video'})</p>
          <div class="item-actions">
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteGalleryItem(${item.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Helper para convertir archivo a Base64 en el navegador
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function uploadLogo(e) {
  e.preventDefault();
  const fileInput = document.getElementById('logo-file-input');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Selecciona un archivo de logo', 'warning');
    return;
  }

  showToast('Procesando y guardando logo...', 'info');

  try {
    const base64 = await fileToBase64(file);
    
    // Guardar vía JSON directo (mucho más rápido y sin problemas de multipart ni borrado en Render)
    const res = await adminApi('/upload/logo', {
      method: 'POST',
      body: JSON.stringify({ logo_base64: base64 })
    });

    // Actualizar vista previa de inmediato
    const preview = document.getElementById('admin-logo-preview');
    preview.src = base64;
    preview.style.display = 'block';

    showToast('¡Logo guardado permanentemente!', 'success');
    document.getElementById('upload-logo-form').reset();
  } catch (err) {
    console.error('Error al subir logo:', err);
    showToast('Error al guardar logo: ' + err.message, 'error');
  }
}

async function uploadImage(e) {
  e.preventDefault();
  const fileInput = document.getElementById('image-file-input');
  const file = fileInput.files[0];
  const title = document.getElementById('image-title-input').value;
  if (!file) {
    showToast('Selecciona un archivo de imagen', 'warning');
    return;
  }

  showToast('Subiendo imagen a la galería...', 'info');

  try {
    const base64 = await fileToBase64(file);

    await adminApi('/gallery/image', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: base64,
        title: title
      })
    });

    showToast('¡Imagen agregada a la galería con éxito!', 'success');
    document.getElementById('upload-image-form').reset();
    await loadAdminGallery();
  } catch (err) {
    console.error('Error al subir imagen:', err);
    showToast('Error al subir imagen: ' + err.message, 'error');
  }
}

async function uploadVideo(e) {
  e.preventDefault();
  const url = document.getElementById('video-url-input').value.trim();
  const fileInput = document.getElementById('video-file-input');
  const file = fileInput.files[0];
  const title = document.getElementById('video-title-input').value.trim();

  try {
    if (url) {
      showToast('Guardando video online...', 'info');
      await adminApi('/gallery/video-url', {
        method: 'POST',
        body: JSON.stringify({ url, title })
      });
      showToast('¡Video online añadido con éxito!', 'success');
    } else if (file) {
      showToast('Subiendo video...', 'info');
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title);
      await adminApi('/gallery/video', {
        method: 'POST',
        body: formData
      });
      showToast('¡Video subido con éxito!', 'success');
    } else {
      showToast('Indica una URL de video o selecciona un archivo', 'warning');
      return;
    }

    document.getElementById('upload-video-form').reset();
    await loadAdminGallery();
  } catch (err) {
    console.error('Error al guardar video:', err);
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('¿Eliminar este elemento de la galería?')) return;
  await adminApi(`/gallery/${id}`, { method: 'DELETE' });
  showToast('Elemento eliminado', 'success');
  loadAdminGallery();
}

// ============ SERVICES ============
async function loadAdminServices() {
  const services = await adminApi('/services/all');
  const tbody = document.getElementById('services-tbody');

  tbody.innerHTML = services.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.description || '-'}</td>
      <td>${s.duration} min</td>
      <td><strong>${s.price}€</strong></td>
      <td>
        <span class="badge ${s.active ? 'badge-completed' : 'badge-cancelled'}">
          ${s.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-dark btn-icon" onclick='editService(${JSON.stringify(s)})'><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteService(${s.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openServiceModal() {
  document.getElementById('service-id').value = '';
  document.getElementById('service-form').reset();
  document.getElementById('service-modal-title').textContent = 'Añadir Servicio';
  document.getElementById('service-modal').classList.add('active');
}

function editService(s) {
  document.getElementById('service-id').value = s.id;
  document.getElementById('service-name').value = s.name;
  document.getElementById('service-desc').value = s.description || '';
  document.getElementById('service-duration').value = s.duration;
  document.getElementById('service-price').value = s.price;
  document.getElementById('service-modal-title').textContent = 'Editar Servicio';
  document.getElementById('service-modal').classList.add('active');
}

async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('service-id').value;
  const data = {
    name: document.getElementById('service-name').value,
    description: document.getElementById('service-desc').value,
    duration: parseInt(document.getElementById('service-duration').value),
    price: parseFloat(document.getElementById('service-price').value)
  };

  try {
    if (id) {
      await adminApi(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Servicio actualizado con éxito', 'success');
    } else {
      await adminApi('/services', { method: 'POST', body: JSON.stringify(data) });
      showToast('Servicio creado con éxito', 'success');
    }
    closeModal('service-modal');
    await loadAdminServices();
  } catch (err) {
    console.error('Error al guardar servicio:', err);
  }
}

async function deleteService(id) {
  if (!confirm('¿Eliminar este servicio?')) return;
  await adminApi(`/services/${id}`, { method: 'DELETE' });
  showToast('Servicio eliminado', 'success');
  loadAdminServices();
}

// ============ BARBERS ============
async function loadAdminBarbers() {
  const barbers = await adminApi('/barbers/all');
  const tbody = document.getElementById('barbers-tbody');

  tbody.innerHTML = barbers.map(b => `
    <tr>
      <td><strong>${b.name}</strong></td>
      <td>${b.speciality || 'Barbero general'}</td>
      <td>
        <span class="badge ${b.active ? 'badge-completed' : 'badge-cancelled'}">
          ${b.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-dark btn-icon" onclick='editBarber(${JSON.stringify(b)})'><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteBarber(${b.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openBarberModal() {
  document.getElementById('barber-id').value = '';
  document.getElementById('barber-form').reset();
  document.getElementById('barber-modal-title').textContent = 'Añadir Barbero';
  document.getElementById('barber-modal').classList.add('active');
}

function editBarber(b) {
  document.getElementById('barber-id').value = b.id;
  document.getElementById('barber-name').value = b.name;
  document.getElementById('barber-speciality').value = b.speciality || '';
  document.getElementById('barber-modal-title').textContent = 'Editar Barbero';
  document.getElementById('barber-modal').classList.add('active');
}

async function saveBarber(e) {
  e.preventDefault();
  const id = document.getElementById('barber-id').value;
  const data = {
    name: document.getElementById('barber-name').value,
    speciality: document.getElementById('barber-speciality').value
  };

  try {
    if (id) {
      await adminApi(`/barbers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Barbero actualizado con éxito', 'success');
    } else {
      await adminApi('/barbers', { method: 'POST', body: JSON.stringify(data) });
      showToast('Barbero añadido con éxito', 'success');
    }
    closeModal('barber-modal');
    await loadAdminBarbers();
  } catch (err) {
    console.error('Error al guardar barbero:', err);
  }
}

async function deleteBarber(id) {
  if (!confirm('¿Eliminar este barbero?')) return;
  await adminApi(`/barbers/${id}`, { method: 'DELETE' });
  showToast('Barbero eliminado', 'success');
  loadAdminBarbers();
}

// ============ SCHEDULE (MORNING, AFTERNOON, NIGHT) ============
async function loadAdminSchedule() {
  const schedules = await adminApi('/schedule');
  const tbody = document.getElementById('schedule-tbody');

  const periodNames = {
    morning: '🌅 Mañana',
    afternoon: '☀️ Tarde',
    night: '🌙 Noche'
  };

  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td><strong>${periodNames[s.period] || s.period}</strong></td>
      <td>${s.start_time}</td>
      <td>${s.end_time}</td>
      <td>Cada ${s.slot_duration} min</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-dark btn-icon" onclick='editSchedule(${JSON.stringify(s)})'><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSchedule(${s.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openScheduleModal() {
  document.getElementById('schedule-id').value = '';
  document.getElementById('schedule-form').reset();
  document.getElementById('schedule-modal-title').textContent = 'Configurar Franja Horaria';
  document.getElementById('schedule-modal').classList.add('active');
}

function editSchedule(s) {
  document.getElementById('schedule-id').value = s.id;
  document.getElementById('schedule-period').value = s.period;
  document.getElementById('schedule-start').value = s.start_time;
  document.getElementById('schedule-end').value = s.end_time;
  document.getElementById('schedule-duration').value = s.slot_duration;
  document.getElementById('schedule-modal-title').textContent = 'Editar Franja';
  document.getElementById('schedule-modal').classList.add('active');
}

async function saveSchedule(e) {
  e.preventDefault();
  const id = document.getElementById('schedule-id').value;
  const data = {
    period: document.getElementById('schedule-period').value,
    start_time: document.getElementById('schedule-start').value,
    end_time: document.getElementById('schedule-end').value,
    slot_duration: parseInt(document.getElementById('schedule-duration').value)
  };

  try {
    if (id) {
      await adminApi(`/schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Horario actualizado con éxito', 'success');
    } else {
      await adminApi('/schedule', { method: 'POST', body: JSON.stringify(data) });
      showToast('Franja horaria añadida con éxito', 'success');
    }
    closeModal('schedule-modal');
    await loadAdminSchedule();
  } catch (err) {
    console.error('Error al guardar horario:', err);
  }
}

async function deleteSchedule(id) {
  if (!confirm('¿Eliminar esta configuración de franja?')) return;
  await adminApi(`/schedule/${id}`, { method: 'DELETE' });
  showToast('Franja eliminada', 'success');
  loadAdminSchedule();
}

// ============ SOCIAL LINKS ============
async function loadAdminSocial() {
  const links = await adminApi('/social-links');
  const tbody = document.getElementById('social-tbody');

  tbody.innerHTML = links.map(l => `
    <tr>
      <td><strong style="text-transform: capitalize;">${l.platform}</strong></td>
      <td><a href="${l.url}" target="_blank">${l.url}</a></td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSocial(${l.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openSocialModal() {
  document.getElementById('social-id').value = '';
  document.getElementById('social-form').reset();
  document.getElementById('social-modal').classList.add('active');
}

async function saveSocial(e) {
  e.preventDefault();
  const data = {
    platform: document.getElementById('social-platform').value,
    url: document.getElementById('social-url').value
  };

  try {
    await adminApi('/social-links', { method: 'POST', body: JSON.stringify(data) });
    showToast('Enlace social añadido con éxito', 'success');
    closeModal('social-modal');
    await loadAdminSocial();
  } catch (err) {
    console.error('Error al guardar red social:', err);
  }
}

async function deleteSocial(id) {
  if (!confirm('¿Eliminar este enlace de red social?')) return;
  await adminApi(`/social-links/${id}`, { method: 'DELETE' });
  showToast('Enlace eliminado', 'success');
  loadAdminSocial();
}

// ============ BRANDING & SETTINGS ============
async function loadAdminSettings() {
  const settings = await adminApi('/settings');
  document.getElementById('setting-shop_name').value = settings.shop_name || '';
  document.getElementById('setting-phone').value = settings.phone || '';
  document.getElementById('setting-hero_title').value = settings.hero_title || '';
  document.getElementById('setting-hero_subtitle').value = settings.hero_subtitle || '';
  document.getElementById('setting-description').value = settings.description || '';
  document.getElementById('setting-address').value = settings.address || '';
  document.getElementById('setting-email').value = settings.email || '';

  if (settings.shop_name) {
    document.getElementById('admin-sidebar-title').textContent = settings.shop_name;
  }

  const preview = document.getElementById('admin-logo-preview');
  if (settings.logo) {
    preview.src = resolveMediaUrl(settings.logo);
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const data = {
    shop_name: document.getElementById('setting-shop_name').value || '',
    phone: document.getElementById('setting-phone').value || '',
    hero_title: document.getElementById('setting-hero_title').value || '',
    hero_subtitle: document.getElementById('setting-hero_subtitle').value || '',
    description: document.getElementById('setting-description').value || '',
    address: document.getElementById('setting-address').value || '',
    email: document.getElementById('setting-email').value || ''
  };

  showToast('Guardando cambios...', 'info');

  try {
    await adminApi('/settings', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    });
    showToast('¡Ajustes y textos guardados con éxito!', 'success');
    if (data.shop_name) {
      document.getElementById('admin-sidebar-title').textContent = data.shop_name;
    }
  } catch (err) {
    console.error('Error al guardar ajustes:', err);
    showToast('Error al guardar: ' + err.message, 'error');
  }
}

async function uploadLogo(e) {
  e.preventDefault();
  const fileInput = document.getElementById('logo-file-input');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Selecciona un archivo de logo', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);

  showToast('Subiendo logo...', 'info');

  try {
    const res = await adminApi('/upload/logo', {
      method: 'POST',
      body: formData
    });

    showToast('¡Logo actualizado con éxito!', 'success');
    document.getElementById('upload-logo-form').reset();
    await loadAdminSettings();
  } catch (err) {
    console.error('Error al subir logo:', err);
  }
}

// ============ SECURITY ============
async function changePassword(e) {
  e.preventDefault();
  const p1 = document.getElementById('new-password').value;
  const p2 = document.getElementById('confirm-password').value;

  if (p1 !== p2) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }

  await adminApi('/settings/password', {
    method: 'POST',
    body: JSON.stringify({ new_password: p1 })
  });

  adminPassword = p1;
  sessionStorage.setItem('sbarber_admin_token', p1);
  showToast('Contraseña de administrador actualizada con éxito', 'success');
  document.getElementById('password-form').reset();
}

// ============ MODALS & TOASTS ============
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Helper para resolver rutas de imágenes relativas contra Render si es necesario
function resolveMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  if (API_BASE && path.startsWith('/uploads')) {
    return `${API_BASE}${path}`;
  }
  return path;
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('admin-toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
