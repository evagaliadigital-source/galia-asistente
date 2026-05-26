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
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    openai: process.env.OPENAI_API_KEY ? "configurado" : "⚠️ NO CONFIGURADO",
  });
});

// ─────────────────────────────────────────────
// POST /lead-message
// Endpoint principal: recibe mensaje, genera respuesta IA, guarda lead
// Body: { name, phone, message, source, leadId? }
// ─────────────────────────────────────────────
app.post("/lead-message", async (req, res) => {
  try {
    const { name, phone, message, source = "web", leadId } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "El campo 'message' es obligatorio" });
    }

    // 1. Buscar lead existente (por ID o por teléfono)
    let lead = leadId
      ? getLeadById(leadId)
      : phone
      ? getLeadByPhone(phone)
      : null;

    // 2. Obtener historial de conversación previo
    const conversationHistory = lead?.conversationHistory || [];

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
      reply: aiReply,
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
// POST /webhook
// Preparado para WhatsApp Cloud API / Twilio / Make
// ─────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    // WhatsApp Cloud API verification
    if (req.query["hub.mode"] === "subscribe") {
      const token = req.query["hub.verify_token"];
      if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return res.send(req.query["hub.challenge"]);
      }
      return res.status(403).send("Forbidden");
    }

    // Procesar mensaje entrante de WhatsApp
    const body = req.body;

    // WhatsApp Cloud API format
    if (body?.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (message && message.type === "text") {
        const phone = message.from;
        const text = message.text.body;

        // Reutilizar la misma lógica de /lead-message
        req.body = { phone, message: text, source: "whatsapp" };

        // Aquí llamarías internamente o reutilizarías el handler
        console.log(`📱 WhatsApp de ${phone}: ${text}`);
        // TODO: implementar envío de respuesta vía WhatsApp API
      }
    }

    // Twilio format
    if (body?.From && body?.Body) {
      const phone = body.From.replace("whatsapp:", "");
      const text = body.Body;
      console.log(`📱 Twilio WhatsApp de ${phone}: ${text}`);
      // TODO: implementar respuesta Twilio
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.status(500).json({ error: "Error interno" });
  }
});

// Verificación GET para WhatsApp Cloud API
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verificado");
    res.send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

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
