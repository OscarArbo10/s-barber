// ============ S BARBER - MAIN JS ============

// State
let selectedService = null;
let selectedBarber = null;
let selectedDate = null;
let selectedTime = null;
let selectedPeriod = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let galleryData = [];
let settings = {};
let currency = '€';

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadServices();
  loadGallery();
  loadSocialLinks();
  renderCalendar();
  setupScrollAnimations();
  setupNavbar();
  document.getElementById('current-year').textContent = new Date().getFullYear();
});

// API Base
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'https://s-barber.onrender.com';

// ============ API HELPERS ============
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}/api${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// Helper para resolver rutas de imágenes relativas contra Render si es necesario
function resolveMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Si tenemos API_BASE (ej: https://s-barber.onrender.com) y la ruta empieza con /uploads
  if (API_BASE && path.startsWith('/uploads')) {
    return `${API_BASE}${path}`;
  }
  return path;
}

// ============ SETTINGS ============
async function loadSettings() {
  settings = await api('/settings');
  currency = settings.currency || '€';
  
  // Update page content
  const brandText = document.getElementById('brand-text');
  if (settings.shop_name) brandText.textContent = settings.shop_name;
  
  const navLogo = document.getElementById('nav-logo');
  if (settings.logo) {
    navLogo.src = resolveMediaUrl(settings.logo);
    navLogo.style.display = 'block';
  }
  
  if (settings.hero_title) {
    const parts = settings.hero_title.split(' ');
    if (parts.length > 1) {
      document.getElementById('hero-title').innerHTML = `${parts[0]} <span>${parts.slice(1).join(' ')}</span>`;
    } else {
      document.getElementById('hero-title').innerHTML = `<span>${settings.hero_title}</span>`;
    }
  }
  
  if (settings.hero_subtitle) document.getElementById('hero-subtitle').textContent = settings.hero_subtitle;
  if (settings.description) {
    document.getElementById('hero-description').textContent = settings.description;
    document.getElementById('footer-description').textContent = settings.description;
  }
  
  if (settings.phone) {
    document.getElementById('contact-phone').textContent = settings.phone;
    document.getElementById('footer-phone').innerHTML = `<i class="fas fa-phone"></i> ${settings.phone}`;
    const phone = settings.phone.replace(/[^0-9+]/g, '');
    document.getElementById('whatsapp-general').href = `https://wa.me/${phone.replace('+', '')}`;
  }
  
  if (settings.address) {
    document.getElementById('contact-address').textContent = settings.address;
    document.getElementById('footer-address').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${settings.address}`;
  }
  
  if (settings.email) {
    document.getElementById('footer-email').innerHTML = `<i class="fas fa-envelope"></i> ${settings.email}`;
  }
  
  if (settings.shop_name) {
    document.getElementById('footer-brand').textContent = settings.shop_name;
    document.getElementById('footer-copyright').textContent = settings.shop_name;
    document.title = `${settings.shop_name} - Tu Barbería de Confianza`;
  }
}

// ============ SERVICES ============
async function loadServices() {
  const services = await api('/services');
  const container = document.getElementById('services-list');
  const bookingContainer = document.getElementById('booking-services');
  
  const icons = ['✂️', '💈', '🪒', '🧔', '👦', '💇', '🧴', '⭐'];
  
  container.innerHTML = services.map((s, i) => `
    <div class="service-card animate-on-scroll">
      <div class="service-icon">${icons[i % icons.length]}</div>
      <h3>${s.name}</h3>
      <p class="description">${s.description}</p>
      <div class="price-duration">
        <span class="price">${s.price}${currency}</span>
        <span class="duration"><i class="fas fa-clock"></i> ${s.duration} min</span>
      </div>
    </div>
  `).join('');
  
  bookingContainer.innerHTML = services.map(s => `
    <div class="select-card" data-id="${s.id}" data-name="${s.name}" data-price="${s.price}" onclick="selectService(this)">
      <h4>${s.name}</h4>
      <p>${s.duration} min</p>
      <div class="card-price">${s.price}${currency}</div>
    </div>
  `).join('');
  
  // Load barbers too
  loadBarbers();
  
  // Re-setup scroll animations
  setTimeout(setupScrollAnimations, 100);
}

async function loadBarbers() {
  const barbers = await api('/barbers');
  const container = document.getElementById('booking-barbers');
  
  container.innerHTML = barbers.map(b => `
    <div class="select-card" data-id="${b.id}" data-name="${b.name}" onclick="selectBarber(this)">
      <h4>💈 ${b.name}</h4>
      <p>${b.speciality || ''}</p>
    </div>
  `).join('');
}

function selectService(el) {
  document.querySelectorAll('#booking-services .select-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedService = {
    id: el.dataset.id,
    name: el.dataset.name,
    price: el.dataset.price
  };
}

function selectBarber(el) {
  document.querySelectorAll('#booking-barbers .select-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedBarber = {
    id: el.dataset.id,
    name: el.dataset.name
  };
}

// ============ GALLERY ============
async function loadGallery() {
  galleryData = await api('/gallery');
  renderGallery('all');
}

function renderGallery(filter) {
  const container = document.getElementById('gallery-grid');
  const items = filter === 'all' ? galleryData : galleryData.filter(g => g.type === filter);
  
  if (items.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--medium-gray);grid-column:1/-1;padding:40px;">No hay contenido disponible aún</p>';
    return;
  }
  
  container.innerHTML = items.map(item => {
    const fullPath = resolveMediaUrl(item.filepath);
    if (item.type === 'image') {
      return `
        <div class="gallery-item animate-on-scroll" onclick="openLightbox('image', '${fullPath}')">
          <img src="${fullPath}" alt="${item.title || 'Galería'}" loading="lazy">
          <div class="overlay">
            <h4>${item.title || ''}</h4>
          </div>
        </div>`;
    } else {
      const isExternal = item.filepath.startsWith('http');
      if (isExternal) {
        // YouTube or external video
        const videoId = extractYouTubeId(item.filepath);
        if (videoId) {
          return `
            <div class="gallery-item animate-on-scroll" onclick="openLightbox('youtube', '${videoId}')">
              <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${item.title || 'Video'}">
              <div class="overlay" style="opacity:1;background:rgba(0,0,0,0.3);align-items:center;justify-content:center;">
                <i class="fas fa-play-circle" style="font-size:3rem;color:white;"></i>
              </div>
            </div>`;
        }
      }
      return `
        <div class="gallery-item animate-on-scroll" onclick="openLightbox('video', '${fullPath}')">
          <video src="${fullPath}" muted></video>
          <div class="overlay" style="opacity:1;background:rgba(0,0,0,0.3);align-items:center;justify-content:center;">
            <i class="fas fa-play-circle" style="font-size:3rem;color:white;"></i>
          </div>
        </div>`;
    }
  }).join('');
  
  setTimeout(setupScrollAnimations, 100);
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function filterGallery(type) {
  document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderGallery(type);
}

// ============ LIGHTBOX ============
function openLightbox(type, src) {
  const lightbox = document.getElementById('lightbox');
  const content = document.getElementById('lightbox-content');
  
  if (type === 'image') {
    content.innerHTML = `<img src="${src}" alt="Galería">`;
  } else if (type === 'youtube') {
    content.innerHTML = `<iframe width="800" height="450" src="https://www.youtube.com/embed/${src}?autoplay=1" frameborder="0" allowfullscreen style="border-radius:12px;max-width:90vw;"></iframe>`;
  } else {
    content.innerHTML = `<video src="${src}" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px;"></video>`;
  }
  
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('active');
  document.getElementById('lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
}

// ============ SOCIAL LINKS ============
async function loadSocialLinks() {
  const links = await api('/social-links');
  const container = document.getElementById('social-links');
  
  const platformIcons = {
    instagram: 'fab fa-instagram',
    facebook: 'fab fa-facebook-f',
    twitter: 'fab fa-twitter',
    x: 'fab fa-x-twitter',
    tiktok: 'fab fa-tiktok',
    youtube: 'fab fa-youtube',
    whatsapp: 'fab fa-whatsapp',
    linkedin: 'fab fa-linkedin-in',
    pinterest: 'fab fa-pinterest',
    threads: 'fab fa-threads',
    snapchat: 'fab fa-snapchat',
    telegram: 'fab fa-telegram',
    web: 'fas fa-globe'
  };
  
  if (links.length === 0) {
    container.innerHTML = '<p style="color:var(--medium-gray);font-size:0.9rem;">Próximamente en redes sociales</p>';
    return;
  }
  
  container.innerHTML = links.map(link => {
    const icon = platformIcons[link.platform.toLowerCase()] || link.icon || 'fas fa-link';
    return `<a href="${link.url}" class="social-link" target="_blank" rel="noopener" title="${link.platform}">
      <i class="${icon}"></i>
    </a>`;
  }).join('');
}

// ============ CALENDAR ============
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-month-title');
  
  title.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  
  let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
  
  // Empty days
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  // Days
  const openingDays = (settings.opening_days || '1,2,3,4,5,6').split(',').map(Number);
  
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = formatDate(date);
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    const isClosed = !openingDays.includes(dayOfWeek);
    const isSelected = selectedDate === dateStr;
    
    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isPast || isClosed) classes += ' disabled';
    if (isSelected) classes += ' selected';
    
    html += `<div class="${classes}" data-date="${dateStr}" ${!isPast && !isClosed ? `onclick="selectDate('${dateStr}')"` : ''}>${day}</div>`;
  }
  
  grid.innerHTML = html;
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedTime = null;
  selectedPeriod = null;
  
  // Highlight selected day
  document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
  document.querySelector(`.calendar-day[data-date="${dateStr}"]`)?.classList.add('selected');
  
  // Load time slots
  const slots = await api(`/time-slots/${dateStr}`);
  const container = document.getElementById('time-slots-container');
  container.style.display = 'block';
  
  renderTimeSlots('morning-grid', slots.morning);
  renderTimeSlots('afternoon-grid', slots.afternoon);
  renderTimeSlots('night-grid', slots.night);
}

function renderTimeSlots(containerId, slots) {
  const container = document.getElementById(containerId);
  if (!slots || slots.length === 0) {
    container.innerHTML = '<p style="color:var(--medium-gray);font-size:0.85rem;padding:8px;">No hay horarios disponibles</p>';
    return;
  }
  
  container.innerHTML = slots.map(slot => {
    const isAvailable = slot.available && (!selectedBarber || slot.barbers.some(b => b.id == selectedBarber.id));
    return `<div class="time-slot ${isAvailable ? '' : 'unavailable'}" 
      ${isAvailable ? `onclick="selectTime('${slot.time}', '${slot.period}')"` : ''}>
      ${slot.time}
    </div>`;
  }).join('');
}

function selectTime(time, period) {
  selectedTime = time;
  selectedPeriod = period;
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
  event.target.classList.add('selected');
}

// ============ BOOKING STEPS ============
function goToStep(step) {
  // Validations
  if (step === 2 && !selectedService) {
    showToast('Por favor, selecciona un servicio', 'error');
    return;
  }
  if (step === 3 && !selectedDate) {
    showToast('Por favor, selecciona una fecha', 'error');
    return;
  }
  if (step === 3 && !selectedTime) {
    showToast('Por favor, selecciona un horario', 'error');
    return;
  }
  if (step === 4) {
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    if (!name || !phone) {
      showToast('Por favor, completa tu nombre y teléfono', 'error');
      return;
    }
    updateSummary();
  }
  
  // Update steps
  document.querySelectorAll('.booking-step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (stepNum === step) s.classList.add('active');
    if (stepNum < step) s.classList.add('completed');
  });
  
  document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
}

function updateSummary() {
  document.getElementById('summary-service').textContent = selectedService?.name || '-';
  document.getElementById('summary-barber').textContent = selectedBarber?.name || 'Sin preferencia';
  document.getElementById('summary-date').textContent = formatDateDisplay(selectedDate);
  document.getElementById('summary-time').textContent = selectedTime || '-';
  document.getElementById('summary-name').textContent = document.getElementById('client-name').value;
  document.getElementById('summary-phone').textContent = document.getElementById('client-phone').value;
  document.getElementById('summary-price').textContent = selectedService ? `${selectedService.price}${currency}` : '-';
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  return `${dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${d} de ${monthNames[parseInt(m) - 1]} ${y}`;
}

async function confirmBooking() {
  const clientName = document.getElementById('client-name').value.trim();
  const clientPhone = document.getElementById('client-phone').value.trim();
  const notes = document.getElementById('client-notes').value.trim();
  
  try {
    const result = await api('/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: clientName,
        client_phone: clientPhone,
        service_id: selectedService?.id,
        barber_id: selectedBarber?.id,
        reservation_date: selectedDate,
        reservation_time: selectedTime,
        period: selectedPeriod,
        notes: notes
      })
    });
    
    // Show success modal
    const phone = clientPhone.replace(/[^0-9]/g, '');
    const shopName = settings.shop_name || 'S Barber';
    const msg = encodeURIComponent(
      `🏪 *${shopName}*\n\nHola! He reservado una cita:\n📅 ${formatDateDisplay(selectedDate)}\n⏰ ${selectedTime}\n✂️ ${selectedService?.name}\n💈 ${selectedBarber?.name || 'Sin preferencia'}\n\n¡Gracias!`
    );
    document.getElementById('modal-whatsapp-btn').href = `https://wa.me/${phone}?text=${msg}`;
    document.getElementById('success-modal').classList.add('active');
    
    // Reset
    selectedService = null;
    selectedBarber = null;
    selectedDate = null;
    selectedTime = null;
    goToStep(1);
    document.querySelectorAll('.select-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-notes').value = '';
    
  } catch (err) {
    showToast(err.message || 'Error al confirmar la reserva', 'error');
  }
}

function closeModal() {
  document.getElementById('success-modal').classList.remove('active');
}

// ============ NAVBAR ============
function setupNavbar() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// Close nav on link click (mobile)
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('open');
  });
});

// ============ SCROLL ANIMATIONS ============
function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

// ============ TOAST ============
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Close lightbox with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeModal();
  }
});
