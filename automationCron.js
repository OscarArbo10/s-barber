const cron = require('node-cron');
const { db } = require('./database');
const { sendWhatsAppMessage } = require('./whatsappService');

/**
 * Tarea periódica que se ejecuta cada 5 minutos:
 * 1. Busca citas pendientes o confirmadas cuya hora esté próxima (dentro de las próximas 2 horas por defecto).
 * 2. Verifica que no se les haya enviado el recordatorio aún (whatsapp_sent == 0).
 * 3. Dispara automáticamente el mensaje de WhatsApp.
 */
function startAutomationCron() {
  console.log('⏰ Servicio de recordatorios automáticos por WhatsApp inicializado.');

  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const reservations = await db.getReservations({ date: todayStr });
      const pendingReminders = reservations.filter(r => 
        (r.status === 'pending' || r.status === 'confirmed') && 
        (!r.whatsapp_sent || r.whatsapp_sent === 0)
      );

      if (pendingReminders.length === 0) return;

      const settings = await db.getSettings();
      const shopName = settings.shop_name || 'S Barber';
      const address = settings.address || '';
      const reminderHoursBefore = parseFloat(process.env.WHATSAPP_REMINDER_HOURS_BEFORE || 2);

      for (const res of pendingReminders) {
        // Calcular tiempo restante para la cita
        const [hour, min] = res.reservation_time.split(':').map(Number);
        const resDateTime = new Date();
        resDateTime.setHours(hour, min, 0, 0);

        const diffMs = resDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Si la cita es en las próximas X horas y aún no ha pasado
        if (diffHours > 0 && diffHours <= reminderHoursBefore) {
          console.log(`[WHATSAPP-CRON] Enviando recordatorio automático a ${res.client_name} (${res.client_phone})...`);

          const message = 
            `💈 *${shopName}* - Recordatorio de Cita 💈\n\n` +
            `¡Hola ${res.client_name}! Te recordamos tu cita de hoy:\n\n` +
            `✂️ *Servicio:* ${res.service_name || 'Servicio de Peluquería'}\n` +
            `👤 *Barbero:* ${res.barber_name || 'Asignado'}\n` +
            `⏰ *Hora:* ${res.reservation_time}\n` +
            `📍 *Ubicación:* ${address}\n\n` +
            `Por favor llega 5 minutos antes. Si necesitas reprogramar, responde a este mensaje. ¡Te esperamos!`;

          const sendResult = await sendWhatsAppMessage(res.client_phone, message);

          if (sendResult.success) {
            await db.updateReservation(res.id, { whatsapp_sent: 1 });
            console.log(`[WHATSAPP-CRON] ✅ Recordatorio completado para ${res.client_name}`);
          }
        }
      }
    } catch (err) {
      console.error('[WHATSAPP-CRON-ERROR] Error procesando recordatorios:', err.message);
    }
  });
}

module.exports = { startAutomationCron };
