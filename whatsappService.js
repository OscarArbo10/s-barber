const axios = require('axios');

/**
 * Servicio encargado de enviar mensajes y recordatorios automáticos por WhatsApp.
 * Soporta:
 * 1) Evolution API (Instancia de WhatsApp Web / QR)
 * 2) Meta Cloud API Oficial
 * 3) Modo Simulador / Log (cuando aún no se han configurado credenciales)
 */
async function sendWhatsAppMessage(toPhone, message) {
  // Limpiar número (solo números)
  const cleanPhone = toPhone.replace(/[^0-9]/g, '');
  const provider = process.env.WHATSAPP_PROVIDER || 'evolution';

  console.log(`[WHATSAPP-SERVICE] Preparando envío para ${cleanPhone} vía ${provider}...`);

  // 1. Proveedor Evolution API
  if (provider === 'evolution' && process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_KEY) {
    try {
      const url = `${process.env.WHATSAPP_API_URL}/message/sendText/${process.env.WHATSAPP_INSTANCE || 'sbarber'}`;
      const response = await axios.post(
        url,
        {
          number: cleanPhone,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
          },
          textMessage: {
            text: message
          }
        },
        {
          headers: {
            'apikey': process.env.WHATSAPP_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log(`[WHATSAPP-SUCCESS] Enviado a ${cleanPhone} por Evolution API.`);
      return { success: true, response: response.data };
    } catch (err) {
      console.error(`[WHATSAPP-ERROR] Error en Evolution API:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Proveedor Meta Cloud API Oficial
  if (provider === 'meta' && process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    try {
      const url = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log(`[WHATSAPP-SUCCESS] Enviado a ${cleanPhone} por Meta Cloud API.`);
      return { success: true, response: response.data };
    } catch (err) {
      console.error(`[WHATSAPP-ERROR] Error en Meta API:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  // 3. Fallback / Simulación en desarrollo
  console.log(`[WHATSAPP-AUTO-SIMULATOR] Mensaje enviado automáticamente a: ${cleanPhone}`);
  console.log(`--------------------------------------------------`);
  console.log(message);
  console.log(`--------------------------------------------------`);
  return { success: true, simulated: true };
}

module.exports = { sendWhatsAppMessage };
