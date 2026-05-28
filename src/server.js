/**
 * ═══════════════════════════════════════════════════════
 *  GALIA BELLEZA - Mini-Asistente de Captación
 *  Backend: Node.js + Express + OpenAI
 * ═══════════════════════════════════════════════════════
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { generateLeadReply } from "./openai.js";
import { generateWaReply } from "./openai-citas.js";
import { Resend } from "resend";
import {
  sendWhatsAppMessage,
  extractWhatsAppMessage,
  markAsRead,
  isWhatsAppConfigured,
} from "./whatsapp.js";
import {
  upsertLead,
  updateConversation,
  updateLeadStatus,
  getAllLeads,
  getLeadById,
  getLeadByPhone,
  initDB,
} from "./db.js";
import { notifyNewLead } from "./notify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// MIDDLEWARES
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
initDB();

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Galia Belleza - Asistente de Captación",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
    openai: (process.env.GSK_API_KEY || process.env.OPENAI_API_KEY) ? "✅ configurado" : "⚠️ NO CONFIGURADO",
    whatsapp: isWhatsAppConfigured()
      ? `✅ configurado (Phone ID: ${process.env.WA_PHONE_NUMBER_ID})`
      : "⚠️ NO CONFIGURADO — faltan WA_PHONE_NUMBER_ID y/o WA_ACCESS_TOKEN",
    verifyToken: process.env.WA_VERIFY_TOKEN || "galia_webhook_2025",
  });
});

// ─────────────────────────────────────────────
// POST /lead-message
// Endpoint principal: recibe mensaje, genera respuesta IA, guarda lead
// Body: { name, phone, message, source, leadId? }
// ─────────────────────────────────────────────
app.post("/lead-message", async (req, res) => {
  try {
    const { name, phone, message, source = "web", leadId, history: clientHistory } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "El campo 'message' es obligatorio" });
    }

    // 1. Buscar lead existente (por ID o por teléfono)
    let lead = leadId
      ? getLeadById(leadId)
      : phone
      ? getLeadByPhone(phone)
      : null;

    // 2. Obtener historial — prioridad: servidor > cliente (fallback si Railway redesplegó)
    const serverHistory = lead?.conversationHistory || [];
    const conversationHistory = serverHistory.length > 0
      ? serverHistory
      : (Array.isArray(clientHistory) ? clientHistory : []);

    // 3. Generar respuesta con OpenAI
    const aiReply = await generateLeadReply(conversationHistory, message);

    // 4. Actualizar historial
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: message },
      { role: "assistant", content: aiReply },
    ];

    // 5. Extraer datos si los menciona en el mensaje (simple heurística)
    const extractedData = extractLeadData(message, lead);

    // 6. Upsert lead en DB
    lead = upsertLead({
      id: lead?.id,
      name: name || extractedData.name || lead?.name,
      phone: phone || lead?.phone,
      salonName: extractedData.salonName || lead?.salonName,
      zone: extractedData.zone || lead?.zone,
      preferredTime: extractedData.preferredTime || lead?.preferredTime,
      lastMessage: message,
      source,
      status: lead?.status || "pendiente_llamar",
    });

    // 7. Guardar historial actualizado
    updateConversation(lead.id, updatedHistory);

    // 8. Notificar si hay datos suficientes (hora + algún dato de identificación)
    const isComplete =
      lead.preferredTime && (lead.salonName || lead.phone || lead.name);
    if (isComplete && !lead._notified) {
      await notifyNewLead(lead, "lead_completo");
      updateLeadStatus(lead.id, "pendiente_llamar");
    } else if (!lead._notified) {
      // Notificar también al primer contacto
      await notifyNewLead(lead, "primer_contacto");
    }

    // 9. Responder al cliente
    return res.json({
      success: true,
      leadId: lead.id,
      reply: aiReply || "Claro 😊 Cuéntame un poco más y te ayudo.",
      leadStatus: lead.status,
      dataCollected: {
        name: lead.name,
        salonName: lead.salonName,
        zone: lead.zone,
        preferredTime: lead.preferredTime,
        phone: lead.phone,
      },
    });
  } catch (error) {
    console.error("❌ Error en /lead-message:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// POST /register-lead
// Registrar lead directamente (desde formulario completo)
// Body: { name, phone, salonName, zone, preferredTime, source, message }
// ─────────────────────────────────────────────
app.post("/register-lead", async (req, res) => {
  try {
    const { name, phone, salonName, zone, preferredTime, source = "formulario", message } = req.body;

    if (!phone && !name) {
      return res.status(400).json({ error: "Se requiere al menos nombre o teléfono" });
    }

    const lead = upsertLead({
      name,
      phone,
      salonName,
      zone,
      preferredTime,
      lastMessage: message || `Registro directo desde ${source}`,
      source,
      status: "pendiente_llamar",
    });

    await notifyNewLead(lead, "registro_directo");

    return res.json({
      success: true,
      leadId: lead.id,
      message: "Lead registrado correctamente",
      lead,
    });
  } catch (error) {
    console.error("❌ Error en /register-lead:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ─────────────────────────────────────────────
// GET /leads
// Panel interno: listar todos los leads
// Query: ?status=pendiente_llamar&limit=50
// ─────────────────────────────────────────────
app.get("/leads", (req, res) => {
  try {
    // Protección básica: solo bloquear desde fuera del navegador si ADMIN_API_KEY está configurada
    // El panel HTML interno envía la key automáticamente via cookie/session
    // Para acceso directo a la API, requiere x-api-key
    const apiKey = req.headers["x-api-key"];
    const referer = req.headers["referer"] || "";
    const isFromPanel = referer.includes("/panel") || referer.includes("localhost");
    if (process.env.ADMIN_API_KEY && !isFromPanel && apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: "No autorizado" });
    }

    let leads = getAllLeads();
    const { status, limit = 100 } = req.query;

    if (status) {
      leads = leads.filter((l) => l.status === status);
    }

    leads = leads.slice(0, parseInt(limit));

    return res.json({
      success: true,
      total: leads.length,
      leads,
    });
  } catch (error) {
    console.error("❌ Error en /leads:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ─────────────────────────────────────────────
// PATCH /leads/:id/status
// Actualizar estado de un lead desde el panel
// Body: { status, notes }
// ─────────────────────────────────────────────
app.patch("/leads/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "pendiente_llamar",
      "llamada_programada",
      "llamado",
      "convertido",
      "no_interesado",
      "no_contesta",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Estado inválido",
        valid: validStatuses,
      });
    }

    const updated = updateLeadStatus(id, status, notes);
    if (!updated) {
      return res.status(404).json({ error: "Lead no encontrado" });
    }

    return res.json({ success: true, lead: updated });
  } catch (error) {
    console.error("❌ Error actualizando estado:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ─────────────────────────────────────────────
// GET /webhook
// Verificación del webhook por Meta Developers
// Meta envía: hub.mode=subscribe, hub.verify_token, hub.challenge
// ─────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WA_VERIFY_TOKEN || "galia_webhook_2025";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("✅ WhatsApp webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.warn(`⚠️ Verificación fallida — token recibido: '${token}' | esperado: '${expectedToken}'`);
    res.status(403).send("Forbidden");
  }
});

// ─────────────────────────────────────────────
// POST /webhook
// Recibe mensajes entrantes de WhatsApp Cloud API
// ─────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  // Responder 200 inmediatamente para que Meta no reintente
  res.status(200).json({ received: true });

  try {
    const body = req.body;

    // Ignorar si no es un evento de WhatsApp Business
    if (body?.object !== "whatsapp_business_account") {
      console.log("📦 Webhook recibido (no WhatsApp):", JSON.stringify(body).slice(0, 200));
      return;
    }

    // Extraer datos del mensaje usando whatsapp.js
    const incoming = extractWhatsAppMessage(body);

    if (!incoming) {
      // Puede ser un status update (delivered, read), no un mensaje de texto
      console.log("📊 Status update de WhatsApp (no mensaje de texto), ignorando.");
      return;
    }

    const { phone, text, messageId, name } = incoming;
    console.log(`📱 WhatsApp entrante | De: ${phone} | Nombre: ${name || "desconocido"} | Msg: ${text}`);

    // Marcar mensaje como leído (tick azul) — fire & forget
    if (messageId && isWhatsAppConfigured()) {
      markAsRead(messageId).catch(() => {});
    }

    // Buscar lead existente por teléfono
    let lead = getLeadByPhone(phone);
    const conversationHistory = lead?.conversationHistory || [];

    // Generar respuesta con IA
    const aiReply = await generateLeadReply(conversationHistory, text);

    // Actualizar historial
    const updatedHistory = [
      ...conversationHistory,
      { role: "user",      content: text },
      { role: "assistant", content: aiReply },
    ];

    // Extraer datos del mensaje (heurística)
    const extractedData = extractLeadData(text, lead);

    // Upsert lead en la base de datos
    lead = upsertLead({
      id:            lead?.id,
      name:          name || extractedData.name || lead?.name,
      phone,
      salonName:     extractedData.salonName  || lead?.salonName,
      zone:          extractedData.zone       || lead?.zone,
      preferredTime: extractedData.preferredTime || lead?.preferredTime,
      lastMessage:   text,
      source:        "whatsapp",
      status:        lead?.status || "pendiente_llamar",
    });

    // Guardar historial actualizado
    updateConversation(lead.id, updatedHistory);

    // Notificaciones al equipo
    const isComplete = lead.preferredTime && (lead.salonName || lead.phone || lead.name);
    if (isComplete && !lead._notified) {
      await notifyNewLead(lead, "lead_completo_whatsapp");
      updateLeadStatus(lead.id, "pendiente_llamar");
    } else if (!lead._notified) {
      await notifyNewLead(lead, "primer_contacto_whatsapp");
    }

    // Enviar respuesta por WhatsApp
    if (isWhatsAppConfigured()) {
      const sendResult = await sendWhatsAppMessage(phone, aiReply);
      if (!sendResult.success) {
        console.error("❌ Fallo al enviar respuesta WhatsApp:", sendResult.error);
      }
    } else {
      console.warn("⚠️ WhatsApp no configurado — respuesta IA generada pero NO enviada:", aiReply);
    }

  } catch (error) {
    console.error("❌ Error procesando webhook WhatsApp:", error.message);
  }
});

// ─────────────────────────────────────────────
// POST /wa-message — Bot WhatsApp de captación
// Body: { message, history? }
// ─────────────────────────────────────────────
app.post("/wa-message", async (req, res) => {
  try {
    const { message, history: clientHistory } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "El campo 'message' es obligatorio" });
    }

    const conversationHistory = Array.isArray(clientHistory) ? clientHistory : [];
    const { reply, isComplete, leadData } = await generateWaReply(conversationHistory, message);

    // Si el bot ha completado el resumen → enviar email a Eva
    if (isComplete && leadData) {
      await sendWaLeadEmail(leadData, message, conversationHistory);
    }

    return res.json({ success: true, reply, isComplete });

  } catch (error) {
    console.error("❌ Error en /wa-message:", error);
    res.status(500).json({ error: "Error interno", message: error.message });
  }
});

/**
 * Email de cierre cuando el bot WA tiene todos los datos del lead
 */
async function sendWaLeadEmail(leadData, lastMessage, history) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const fecha = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo lead WhatsApp</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- CABECERA -->
        <tr>
          <td style="background:linear-gradient(135deg,#075e54,#25d366);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:28px;">📱</p>
            <h1 style="margin:8px 0 4px;color:#fff;font-size:20px;font-weight:700;">Nuevo lead — Bot WhatsApp</h1>
            <p style="margin:0;color:#dcfce7;font-size:13px;">${fecha}</p>
          </td>
        </tr>

        <!-- DATOS -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${leadData.name ? `<tr><td style="padding:8px 0;"><span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Nombre</span><br><span style="font-size:15px;color:#111827;font-weight:500;">${leadData.name}</span></td></tr>` : ""}
              ${leadData.businessType ? `<tr><td style="padding:8px 0;"><span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Tipo de negocio</span><br><span style="font-size:15px;color:#111827;font-weight:500;">${leadData.businessType}</span></td></tr>` : ""}
              ${leadData.zone ? `<tr><td style="padding:8px 0;"><span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Zona</span><br><span style="font-size:15px;color:#111827;font-weight:500;">${leadData.zone}</span></td></tr>` : ""}
              ${leadData.preference ? `<tr><td style="padding:8px 0;"><span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Preferencia</span><br><span style="font-size:15px;color:#111827;font-weight:500;">${leadData.preference}</span></td></tr>` : ""}
              <tr>
                <td style="padding-top:20px;">
                  <p style="margin:0 0 6px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Último mensaje</p>
                  <div style="background:#f0fdf4;border-left:3px solid #25d366;border-radius:0 8px 8px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">&ldquo;${lastMessage}&rdquo;</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Galia Belleza · Bot WhatsApp de captación</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: "Asistente GALia <onboarding@resend.dev>",
      to: "info.galiabelleza@gmail.com",
      subject: `📱 Nuevo lead WA — ${leadData.name || "Sin nombre"} · ${leadData.zone || "Sin zona"}`,
      html,
    });
    if (error) console.error("❌ Email WA lead error:", error);
    else console.log(`✅ Email WA lead enviado — ID: ${data?.id}`);
  } catch (err) {
    console.error("❌ Error enviando email WA:", err.message);
  }
}

// ─────────────────────────────────────────────
// RUTAS WEB (Panel y Formulario)
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/panel.html"));
});

app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/test.html"));
});

app.get("/test-wa", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/test-wa.html"));
});

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n🌸 ═══════════════════════════════════════════");
  console.log("🌸  GALIA BELLEZA - Asistente de Captación");
  console.log("🌸 ═══════════════════════════════════════════");
  console.log(`🚀 Servidor en: http://localhost:${PORT}`);
  console.log(`📋 Panel:       http://localhost:${PORT}/panel`);
  console.log(`🔗 API:         http://localhost:${PORT}/leads`);
  console.log(
    `🤖 OpenAI:      ${process.env.OPENAI_API_KEY ? "✅ Configurado" : "⚠️  FALTA OPENAI_API_KEY"}`
  );
  console.log("🌸 ═══════════════════════════════════════════\n");
});

// ─────────────────────────────────────────────
// UTILIDAD: Extraer datos del mensaje
// ─────────────────────────────────────────────
function extractLeadData(message, existingLead = {}) {
  const text = message.toLowerCase();
  const result = {};

  // Detectar franja horaria / hora
  const timePatterns = [
    /(\d{1,2})[:\.](\d{2})\s*(h|hora|pm|am)?/i,
    /(mañana|mediodía|mediodia|tarde|noche)/i,
    /(entre las|de|a las|sobre las)\s*\d{1,2}/i,
    /(9|10|11|12|13|14|15|16|17|18|19|20)\s*(h|hora|:)/i,
    /(por la mañana|por la tarde|por la noche)/i,
    /(mañana a|hoy a|el lunes|el martes|el miércoles|el jueves|el viernes)/i,
  ];

  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match && !existingLead?.preferredTime) {
      result.preferredTime = match[0];
      break;
    }
  }

  // Detectar nombre de salón
  const salonPatterns = [
    /(?:se llama|llamamos|mi salón|mi peluquería|mi centro|mi barbería|nombre es|es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s&'-]{2,30})/i,
    /(?:peluquería|salón|barbería|centro|studio)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s&'-]{2,20})/i,
  ];

  for (const pattern of salonPatterns) {
    const match = message.match(pattern);
    if (match && !existingLead?.salonName) {
      result.salonName = match[1]?.trim();
      break;
    }
  }

  // Detectar zona / ciudad (lista de ciudades principales + barrios Madrid)
  const cities = [
    "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga",
    "Murcia", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo",
    "Gijón", "Granada", "Vitoria", "Leganés", "Móstoles", "Alcalá",
    "Fuenlabrada", "Torrejón", "Alcorcón", "Getafe", "Carabanchel",
    "Vallecas", "Chamberí", "Salamanca", "Retiro", "Arganzuela",
    "Usera", "Latina", "Moncloa", "Hortaleza", "Barajas", "Tetuán",
  ];

  for (const city of cities) {
    if (
      text.includes(city.toLowerCase()) && !existingLead?.zone
    ) {
      result.zone = city;
      break;
    }
  }

  // Detectar nombre de persona (si dice "soy X" o "me llamo X")
  const nameMatch = message.match(/(?:soy|me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚa-záéíóú]{2,20})/i);
  if (nameMatch && !existingLead?.name) {
    result.name = nameMatch[1];
  }

  return result;
}

export default app;
