const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'sbarber_data.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('tu-proyecto') &&
  supabaseUrl.startsWith('http')
);

let supabase = null;
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('⚡ Conectado a Supabase en la nube con éxito.');
} else {
  console.log('📁 Modo Local activo (JSON Database). Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env para conectar a la nube.');
}

// Fallback Local
const defaultData = {
  settings: {
    shop_name: 'S Barber',
    description: 'Tu barbería de confianza. Estilo, elegancia y precisión en cada corte.',
    phone: '+34 600 000 000',
    address: 'Calle Principal 123, Ciudad',
    email: 'info@sbarber.com',
    logo: '',
    hero_title: 'S BARBER',
    hero_subtitle: 'Estilo & Precisión',
    currency: '€',
    admin_password: 'admin123'
  },
  gallery: [],
  social_links: [
    { id: 1, platform: 'instagram', url: 'https://instagram.com', sort_order: 1 },
    { id: 2, platform: 'whatsapp', url: 'https://wa.me/34600000000', sort_order: 2 }
  ],
  services: [
    { id: 1, name: 'Corte Clásico', description: 'Corte de cabello tradicional con acabado profesional', duration: 30, price: 15, active: 1 },
    { id: 2, name: 'Corte + Barba', description: 'Corte de cabello y arreglo de barba completo', duration: 45, price: 22, active: 1 },
    { id: 3, name: 'Afeitado Clásico', description: 'Afeitado con navaja y toalla caliente', duration: 30, price: 12, active: 1 },
    { id: 4, name: 'Diseño de Barba', description: 'Perfilado y diseño personalizado de barba', duration: 30, price: 15, active: 1 }
  ],
  barbers: [
    { id: 1, name: 'Carlos', speciality: 'Cortes modernos y fade', active: 1 },
    { id: 2, name: 'Miguel', speciality: 'Barbas y afeitado clásico', active: 1 }
  ],
  schedule_config: [
    { id: 1, period: 'morning', start_time: '09:00', end_time: '13:00', slot_duration: 30 },
    { id: 2, period: 'afternoon', start_time: '14:00', end_time: '18:00', slot_duration: 30 },
    { id: 3, period: 'night', start_time: '18:00', end_time: '21:00', slot_duration: 30 }
  ],
  reservations: []
};

function readLocalDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return defaultData;
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// CAPA DE ACCESO UNIFICADA (Supabase con fallback a archivo local)
const db = {
  isSupabase: isSupabaseConfigured,
  supabase,

  // SETTINGS
  async getSettings() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('*');
        if (!error && data && data.length > 0) {
          const map = {};
          data.forEach(r => map[r.key] = r.value);
          return map;
        }
      } catch (err) {
        console.error('[SUPABASE-ERROR] Error leyendo settings, usando fallback local:', err.message || err);
      }
    }
    return readLocalDb().settings;
  },

  async updateSettings(settingsMap) {
    if (isSupabaseConfigured && supabase) {
      try {
        const entries = Object.entries(settingsMap).map(([key, value]) => ({ key, value: String(value) }));
        const { error } = await supabase.from('settings').upsert(entries, { onConflict: 'key' });
        if (error) console.error('[SUPABASE-ERROR] Error guardando settings:', error.message);
      } catch (err) {
        console.error('[SUPABASE-ERROR]:', err.message || err);
      }
    }
    const local = readLocalDb();
    Object.assign(local.settings, settingsMap);
    writeLocalDb(local);
    return true;
  },

  // SERVICES
  async getServices(all = false) {
    if (isSupabaseConfigured) {
      let query = supabase.from('services').select('*').order('id', { ascending: true });
      if (!all) query = query.eq('active', 1);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    const list = readLocalDb().services;
    return all ? list : list.filter(s => s.active === 1);
  },

  async addService(srv) {
    if (isSupabaseConfigured && supabase) {
      try {
        const itemToInsert = {
          name: srv.name,
          description: srv.description || '',
          duration: Number(srv.duration) || 30,
          price: Number(srv.price) || 0,
          active: 1
        };
        const { data, error } = await supabase.from('services').insert([itemToInsert]).select();
        if (!error && data && data.length > 0) return data[0];
        console.error('[SUPABASE-SERVICES-ERROR]:', error?.message);
      } catch (e) {
        console.error('[SUPABASE-SERVICES-CATCH]:', e.message);
      }
    }
    const local = readLocalDb();
    const item = { id: Date.now(), ...srv, active: 1 };
    local.services.push(item);
    writeLocalDb(local);
    return item;
  },

  async updateService(id, updates) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('services').update(updates).eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    const idx = local.services.findIndex(s => s.id == id);
    if (idx !== -1) {
      local.services[idx] = { ...local.services[idx], ...updates };
      writeLocalDb(local);
    }
    return true;
  },

  async deleteService(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.services = local.services.filter(s => s.id != id);
    writeLocalDb(local);
    return true;
  },

  // BARBERS
  async getBarbers(all = false) {
    if (isSupabaseConfigured) {
      let query = supabase.from('barbers').select('*').order('id', { ascending: true });
      if (!all) query = query.eq('active', 1);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    const list = readLocalDb().barbers;
    return all ? list : list.filter(b => b.active === 1);
  },

  async addBarber(b) {
    if (isSupabaseConfigured && supabase) {
      try {
        const itemToInsert = {
          name: b.name,
          speciality: b.speciality || '',
          active: 1
        };
        const { data, error } = await supabase.from('barbers').insert([itemToInsert]).select();
        if (!error && data && data.length > 0) return data[0];
        console.error('[SUPABASE-BARBER-ERROR]:', error?.message);
      } catch (e) {
        console.error('[SUPABASE-BARBER-CATCH]:', e.message);
      }
    }
    const local = readLocalDb();
    const item = { id: Date.now(), ...b, active: 1 };
    local.barbers.push(item);
    writeLocalDb(local);
    return item;
  },

  async updateBarber(id, updates) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('barbers').update(updates).eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    const idx = local.barbers.findIndex(b => b.id == id);
    if (idx !== -1) {
      local.barbers[idx] = { ...local.barbers[idx], ...updates };
      writeLocalDb(local);
    }
    return true;
  },

  async deleteBarber(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('barbers').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.barbers = local.barbers.filter(b => b.id != id);
    writeLocalDb(local);
    return true;
  },

  // SCHEDULE
  async getSchedule() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('schedule_config').select('*').order('id');
      if (error) throw error;
      return data;
    }
    return readLocalDb().schedule_config;
  },

  async addSchedule(sch) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('schedule_config').insert([sch]).select();
      if (error) throw error;
      return data[0];
    }
    const local = readLocalDb();
    const item = { id: Date.now(), ...sch };
    local.schedule_config.push(item);
    writeLocalDb(local);
    return item;
  },

  async updateSchedule(id, updates) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('schedule_config').update(updates).eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    const idx = local.schedule_config.findIndex(s => s.id == id);
    if (idx !== -1) {
      local.schedule_config[idx] = { ...local.schedule_config[idx], ...updates };
      writeLocalDb(local);
    }
    return true;
  },

  async deleteSchedule(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('schedule_config').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.schedule_config = local.schedule_config.filter(s => s.id != id);
    writeLocalDb(local);
    return true;
  },

  // GALLERY
  async getGallery() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('gallery').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    }
    return readLocalDb().gallery;
  },

  async addGalleryItem(item) {
    if (isSupabaseConfigured && supabase) {
      try {
        const itemToInsert = {
          type: item.type,
          filepath: item.filepath,
          title: item.title || '',
          description: item.description || '',
          sort_order: 0
        };
        const { data, error } = await supabase.from('gallery').insert([itemToInsert]).select();
        if (!error && data && data.length > 0) return data[0];
        console.error('[SUPABASE-GALLERY-ERROR]:', error?.message);
      } catch (e) {
        console.error('[SUPABASE-GALLERY-CATCH]:', e.message);
      }
    }
    const local = readLocalDb();
    const newItem = { id: Date.now(), ...item, created_at: new Date().toISOString() };
    local.gallery.push(newItem);
    writeLocalDb(local);
    return newItem;
  },

  async deleteGalleryItem(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('gallery').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.gallery = local.gallery.filter(g => g.id != id);
    writeLocalDb(local);
    return true;
  },

  // SOCIAL
  async getSocialLinks() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('social_links').select('*').order('sort_order');
      if (error) throw error;
      return data;
    }
    return readLocalDb().social_links;
  },

  async addSocialLink(link) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('social_links').insert([link]).select();
      if (error) throw error;
      return data[0];
    }
    const local = readLocalDb();
    const newItem = { id: Date.now(), ...link };
    local.social_links.push(newItem);
    writeLocalDb(local);
    return newItem;
  },

  async deleteSocialLink(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('social_links').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.social_links = local.social_links.filter(l => l.id != id);
    writeLocalDb(local);
    return true;
  },

  // RESERVATIONS
  async getReservations(filter = {}) {
    if (isSupabaseConfigured) {
      let query = supabase.from('reservations').select('*, services(name, price), barbers(name)').order('id', { ascending: false });
      if (filter.date) query = query.eq('reservation_date', filter.date);
      if (filter.status) query = query.eq('status', filter.status);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => ({
        ...r,
        service_name: r.services?.name || '',
        service_price: r.services?.price || 0,
        barber_name: r.barbers?.name || ''
      }));
    }
    const local = readLocalDb();
    let list = local.reservations.map(r => {
      const s = local.services.find(srv => srv.id == r.service_id);
      const b = local.barbers.find(bar => bar.id == r.barber_id);
      return {
        ...r,
        service_name: s ? s.name : '',
        service_price: s ? s.price : 0,
        barber_name: b ? b.name : ''
      };
    });
    if (filter.date) list = list.filter(r => r.reservation_date === filter.date);
    if (filter.status) list = list.filter(r => r.status === filter.status);
    return list.sort((a, b) => b.id - a.id);
  },

  async addReservation(resData) {
    if (isSupabaseConfigured) {
      // Verificar si ya existe
      const { data: conflict } = await supabase.from('reservations')
        .select('id')
        .eq('reservation_date', resData.reservation_date)
        .eq('reservation_time', resData.reservation_time)
        .eq('barber_id', resData.barber_id)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (conflict) {
        throw new Error('Este horario ya está reservado para este barbero');
      }

      const { data, error } = await supabase.from('reservations').insert([resData]).select();
      if (error) throw error;
      return data[0];
    }

    const local = readLocalDb();
    const conflict = local.reservations.find(r => 
      r.reservation_date === resData.reservation_date &&
      r.reservation_time === resData.reservation_time &&
      r.barber_id == resData.barber_id &&
      r.status !== 'cancelled'
    );
    if (conflict) throw new Error('Este horario ya está reservado para este barbero');

    const newItem = { id: Date.now(), ...resData, created_at: new Date().toISOString() };
    local.reservations.push(newItem);
    writeLocalDb(local);
    return newItem;
  },

  async updateReservation(id, updates) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('reservations').update(updates).eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    const idx = local.reservations.findIndex(r => r.id == id);
    if (idx !== -1) {
      local.reservations[idx] = { ...local.reservations[idx], ...updates };
      writeLocalDb(local);
    }
    return true;
  },

  async deleteReservation(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = readLocalDb();
    local.reservations = local.reservations.filter(r => r.id != id);
    writeLocalDb(local);
    return true;
  }
};

function initialize() {
  if (!isSupabaseConfigured) {
    readLocalDb();
  }
}

module.exports = { db, initialize };
