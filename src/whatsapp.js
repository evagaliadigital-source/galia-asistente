/**
 * GALia Belleza - Módulo WhatsApp Cloud API
 * Envía y recibe mensajes via Meta WhatsApp Business API
 */

// ─────────────────────────────────────────────
// CONFIGURACIÓN — desde variables de entorno
// ─────────────────────────────────────────────
const WA_CONFIG = {
  phoneNumberId:  process.env.WA_PHONE_NUMBER_ID,
  accessToken:    process.env.WA_ACCESS_TOKEN,
  verifyToken:    process.env.WA_VERIFY_TOKEN || "galia_webhook_2025",
  apiVersion:     "v20.0",
};

/**
 * Envía un mensaje de texto a un número de WhatsApp
 * @param {string} to      - Número destino formato internacional sin + (ej: 34611222333)
 * @param {string} message - Texto a enviar
 */
export async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/${WA_CONFIG.apiVersion}/${WA_CONFIG.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WA_CONFIG.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^0-9]/g, ""), // limpiar formato
        type: "text",
        text: { body: message },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ WhatsApp API error:", JSON.stringify(data));
      return { success: false, error: data };
    }

    console.log(`✅ WhatsApp enviado a ${to} | msg_id: ${data.messages?.[0]?.id}`);
    return { success: true, data };

  } catch (err) {
    console.error("❌ Error enviando WhatsApp:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Marca un mensaje como leído (tick azul)
 * @param {string} messageId - ID del mensaje recibido
 */
export async function markAsRead(messageId) {
  const url = `https://graph.facebook.com/${WA_CONFIG.apiVersion}/${WA_CONFIG.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WA_CONFIG.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (_) {}
}

/**
 * Extrae el mensaje de texto del payload de WhatsApp Cloud API
 * @param {Object} body - Body del webhook
 * @returns {Object|null} - { phone, text, messageId, name } o null
 */
export function extractWhatsAppMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;

    // Solo procesar mensajes de texto entrantes
    const message = value?.messages?.[0];
    if (!message || message.type !== "text") return null;

    const contact = value?.contacts?.[0];

    return {
      phone:     message.from,                    // ej: "34611222333"
      text:      message.text?.body?.trim(),       // texto del mensaje
      messageId: message.id,                       // para marcar como leído
      name:      contact?.profile?.name || null,   // nombre del contacto si existe
      timestamp: message.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Verifica que la config de WhatsApp está completa
 */
export function isWhatsAppConfigured() {
  return !!(WA_CONFIG.phoneNumberId && WA_CONFIG.accessToken);
}

export { WA_CONFIG };
