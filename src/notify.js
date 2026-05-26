/**
 * Galia Belleza - Sistema de Notificaciones Internas
 * Notifica a Eva/Nuria cuando llega un nuevo lead
 * 
 * PREPARADO PARA: Email, Telegram, Slack, Make webhook
 * DE MOMENTO: Log en consola + archivo de notificaciones
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTIFY_LOG = path.join(__dirname, "../data/notifications.json");

/**
 * Notificación principal de nuevo lead
 * @param {Object} lead - Datos del lead
 * @param {string} triggerEvent - Qué disparó la notificación
 */
export async function notifyNewLead(lead, triggerEvent = "new_lead") {
  const notification = {
    timestamp: new Date().toISOString(),
    event: triggerEvent,
    lead: {
      id: lead.id,
      name: lead.name || "Sin nombre",
      salonName: lead.salonName || "Sin especificar",
      zone: lead.zone || "Sin especificar",
      phone: lead.phone || "Sin teléfono",
      preferredTime: lead.preferredTime || "Sin confirmar",
      lastMessage: lead.lastMessage,
      source: lead.source,
      status: lead.status,
    },
  };

  // 1. LOG EN CONSOLA (siempre activo)
  console.log("\n🔔 ─────────────────────────────────────────");
  console.log("🔔 NUEVO LEAD - NOTIFICACIÓN INTERNA");
  console.log("🔔 ─────────────────────────────────────────");
  console.log(`📅 Fecha:    ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`);
  console.log(`👤 Nombre:   ${notification.lead.name}`);
  console.log(`💇 Salón:    ${notification.lead.salonName}`);
  console.log(`📍 Zona:     ${notification.lead.zone}`);
  console.log(`📱 Teléfono: ${notification.lead.phone}`);
  console.log(`⏰ Horario:  ${notification.lead.preferredTime}`);
  console.log(`📨 Mensaje:  ${notification.lead.lastMessage}`);
  console.log(`🔗 Fuente:   ${notification.lead.source}`);
  console.log("🔔 ─────────────────────────────────────────\n");

  // 2. GUARDAR EN LOG JSON
  saveNotificationLog(notification);

  // 3. WEBHOOK EXTERNO (Make/Zapier/n8n)
  // Descomenta y configura cuando tengas el webhook de Make:
  // await sendToMakeWebhook(notification);

  // 4. EMAIL (cuando configures SMTP o SendGrid)
  // await sendEmailNotification(notification);

  // 5. TELEGRAM (cuando configures el bot)
  // await sendTelegramNotification(notification);

  return notification;
}

/**
 * Guarda la notificación en el log local
 */
function saveNotificationLog(notification) {
  try {
    let logs = [];
    if (fs.existsSync(NOTIFY_LOG)) {
      logs = JSON.parse(fs.readFileSync(NOTIFY_LOG, "utf-8"));
    }
    logs.unshift(notification); // Más recientes primero
    // Mantener solo los últimos 500
    if (logs.length > 500) logs = logs.slice(0, 500);
    fs.writeFileSync(NOTIFY_LOG, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("⚠️ Error guardando notificación:", err.message);
  }
}

/**
 * ─── MAKE / ZAPIER / n8n WEBHOOK ─────────────────────
 * Activa esto cuando tengas el webhook configurado en Make
 * Así Eva y Nuria reciben la notificación donde quieran
 */
async function sendToMakeWebhook(notification) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "nuevo_lead_galia",
        para: "Eva, Nuria",
        asunto: `🔔 Nuevo lead: ${notification.lead.salonName} (${notification.lead.zone})`,
        datos: notification.lead,
        accion_requerida: "Llamar en franja horaria indicada",
      }),
    });
    console.log("✅ Notificación enviada a Make");
  } catch (err) {
    console.error("⚠️ Error webhook Make:", err.message);
  }
}

/**
 * ─── TELEGRAM ─────────────────────────────────────────
 * Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env
 */
async function sendTelegramNotification(notification) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const l = notification.lead;
  const text = `
🔔 *NUEVO LEAD - Galia Belleza*

👤 *Nombre:* ${l.name}
💇 *Salón:* ${l.salonName}
📍 *Zona:* ${l.zone}
📱 *Teléfono:* ${l.phone}
⏰ *Franja:* ${l.preferredTime}
📨 *Mensaje:* ${l.lastMessage}
🔗 *Fuente:* ${l.source}

✅ _Accede al panel para gestionar_
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    console.log("✅ Notificación enviada a Telegram");
  } catch (err) {
    console.error("⚠️ Error Telegram:", err.message);
  }
}
