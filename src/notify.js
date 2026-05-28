/**
 * Galia Belleza - Sistema de Notificaciones Internas
 * Email via Resend — info.galiabelleza@gmail.com
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTIFY_LOG = path.join(__dirname, "../data/notifications.json");

const EMAIL_TO = "info.galiabelleza@gmail.com";
const EMAIL_FROM = "Asistente GALia <onboarding@resend.dev>"; // dominio propio cuando esté verificado

/**
 * Notificación principal de nuevo lead
 * @param {Object} lead - Datos del lead
 * @param {string} triggerEvent - "primer_contacto" | "lead_completo"
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
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  console.log("\n🔔 ─────────────────────────────────────────");
  console.log(`🔔 NUEVO LEAD [${triggerEvent}]`);
  console.log("🔔 ─────────────────────────────────────────");
  console.log(`📅 Fecha:    ${fecha}`);
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

  // 3. EMAIL VIA RESEND
  await sendEmailNotification(notification, fecha);

  return notification;
}

/**
 * Envía email de notificación via Resend
 */
async function sendEmailNotification(notification, fecha) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY no configurada — email omitido");
    return;
  }

  const resend = new Resend(apiKey);
  const l = notification.lead;

  const esPrimerContacto = notification.event === "primer_contacto";
  const asunto = esPrimerContacto
    ? `🔔 Nuevo contacto en el chat — ${l.zone !== "Sin especificar" ? l.zone : l.source}`
    : `✅ Lead con datos — ${l.salonName} · ${l.zone}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${asunto}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- CABECERA -->
          <tr>
            <td style="background:linear-gradient(135deg,#64358F,#a855f7);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:28px;">🐙</p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:20px;font-weight:700;">
                ${esPrimerContacto ? "Nuevo contacto en el chat" : "Lead con datos completos"}
              </h1>
              <p style="margin:0;color:#e9d5ff;font-size:13px;">${fecha}</p>
            </td>
          </tr>

          <!-- BADGE EVENTO -->
          <tr>
            <td style="padding:20px 32px 0;text-align:center;">
              <span style="display:inline-block;padding:6px 16px;border-radius:999px;font-size:12px;font-weight:600;
                ${esPrimerContacto
                  ? "background:#fef3c7;color:#92400e;"
                  : "background:#d1fae5;color:#065f46;"}">
                ${esPrimerContacto ? "⚡ Primer contacto" : "✅ Lead con datos"}
              </span>
            </td>
          </tr>

          <!-- DATOS DEL LEAD -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">

                ${fila("💇", "Salón", l.salonName)}
                ${fila("📍", "Zona", l.zone)}
                ${fila("📱", "Teléfono", l.phone)}
                ${fila("⏰", "Franja horaria", l.preferredTime)}
                ${fila("🔗", "Fuente", l.source)}

                <!-- ÚLTIMO MENSAJE -->
                <tr>
                  <td colspan="2" style="padding-top:16px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Último mensaje</p>
                    <div style="background:#f9fafb;border-left:3px solid #a855f7;border-radius:0 8px 8px 0;padding:12px 16px;">
                      <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"${l.lastMessage || "—"}"</p>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="https://galia-asistente-production.up.railway.app/panel"
                style="display:inline-block;background:linear-gradient(135deg,#64358F,#a855f7);color:#ffffff;
                text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                Ver panel de leads →
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Galia Belleza · Asistente de captación</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: asunto,
      html,
    });

    if (error) {
      console.error("❌ Error Resend:", error);
    } else {
      console.log(`✅ Email enviado — ID: ${data?.id} | Evento: ${notification.event}`);
    }
  } catch (err) {
    console.error("❌ Error enviando email:", err.message);
  }
}

/**
 * Helper — fila de datos en el email
 */
function fila(emoji, label, value) {
  if (!value || value === "Sin especificar" || value === "Sin teléfono" || value === "Sin confirmar" || value === "Sin nombre") {
    return ""; // No mostrar filas vacías
  }
  return `
    <tr>
      <td style="padding:8px 0;vertical-align:top;width:40px;font-size:16px;">${emoji}</td>
      <td style="padding:8px 0;vertical-align:top;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${label}</span><br>
        <span style="font-size:14px;color:#111827;font-weight:500;">${value}</span>
      </td>
    </tr>`;
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
    logs.unshift(notification);
    if (logs.length > 500) logs = logs.slice(0, 500);
    fs.writeFileSync(NOTIFY_LOG, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("⚠️ Error guardando notificación:", err.message);
  }
}
