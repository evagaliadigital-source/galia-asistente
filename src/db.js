/**
 * Galia Belleza - Base de datos local en JSON + cache en memoria
 * Cache en memoria = fuente de verdad durante la sesión del proceso
 * JSON en disco = persistencia entre reinicios del servidor
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../data/leads.json");

// ─────────────────────────────────────────────
// CACHE EN MEMORIA — fuente de verdad en runtime
// Se inicializa leyendo el JSON al arrancar
// ─────────────────────────────────────────────
let _memoryCache = null; // { leads: [...] }

function getCache() {
  if (!_memoryCache) {
    // Primera llamada: cargar desde disco
    _memoryCache = _readFromDisk();
    console.log(`💾 BD cargada en memoria: ${_memoryCache.leads.length} leads`);
  }
  return _memoryCache;
}

function _readFromDisk() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { leads: [] };
  }
}

function _writeToDisk(data) {
  try {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ No se pudo escribir en disco (ok en Railway efímero):", err.message);
  }
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN (compatibilidad)
// ─────────────────────────────────────────────
function initDB() {
  getCache(); // Asegura que el cache está cargado
}

function readDB() {
  return getCache();
}

function writeDB(data) {
  _memoryCache = data; // Actualizar cache en memoria (instantáneo)
  _writeToDisk(data);  // Persistir en disco (best-effort)
}

// ─────────────────────────────────────────────
// OPERACIONES DE LEADS
// ─────────────────────────────────────────────

/**
 * Crea un nuevo lead o actualiza uno existente por teléfono
 */
export function upsertLead(leadData) {
  initDB();
  const db = readDB();

  const existingIndex = db.leads.findIndex(
    (l) => l.phone && l.phone === leadData.phone
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Actualizar lead existente
    const existing = db.leads[existingIndex];
    db.leads[existingIndex] = {
      ...existing,
      ...leadData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      lastMessage: leadData.lastMessage || leadData.message || existing.lastMessage,
      // Mantener estado si ya está en proceso, a menos que se actualice
      status: leadData.status || existing.status,
    };
    writeDB(db);
    return db.leads[existingIndex];
  } else {
    // Crear nuevo lead
    const newLead = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      name: leadData.name || null,
      salonName: leadData.salonName || null,
      zone: leadData.zone || null,
      phone: leadData.phone || null,
      preferredTime: leadData.preferredTime || null,
      lastMessage: leadData.message || leadData.lastMessage || null,
      source: leadData.source || "web",
      status: "pendiente_llamar",
      conversationHistory: [],
      notes: "",
    };
    db.leads.push(newLead);
    writeDB(db);
    return newLead;
  }
}

/**
 * Guarda o actualiza el historial de conversación de un lead
 */
export function updateConversation(leadId, conversationHistory) {
  initDB();
  const db = readDB();
  const idx = db.leads.findIndex((l) => l.id === leadId);
  if (idx >= 0) {
    db.leads[idx].conversationHistory = conversationHistory;
    db.leads[idx].updatedAt = new Date().toISOString();
    writeDB(db);
  }
}

/**
 * Actualiza el estado de un lead
 */
export function updateLeadStatus(leadId, status, notes = "") {
  initDB();
  const db = readDB();
  const idx = db.leads.findIndex((l) => l.id === leadId);
  if (idx >= 0) {
    db.leads[idx].status = status;
    db.leads[idx].updatedAt = new Date().toISOString();
    if (notes) db.leads[idx].notes = notes;
    writeDB(db);
    return db.leads[idx];
  }
  return null;
}

/**
 * Obtiene todos los leads, ordenados por fecha (más recientes primero)
 */
export function getAllLeads() {
  initDB();
  const db = readDB();
  return db.leads.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * Obtiene leads por estado
 */
export function getLeadsByStatus(status) {
  const all = getAllLeads();
  return all.filter((l) => l.status === status);
}

/**
 * Obtiene un lead por ID
 */
export function getLeadById(id) {
  const db = readDB();
  return db.leads.find((l) => l.id === id) || null;
}

/**
 * Obtiene un lead por teléfono
 */
export function getLeadByPhone(phone) {
  const db = readDB();
  return db.leads.find((l) => l.phone === phone) || null;
}

/**
 * Borra un lead por ID
 */
export function deleteLead(id) {
  const db = readDB();
  const index = db.leads.findIndex((l) => l.id === id);
  
  if (index === -1) {
    return { success: false, message: "Lead no encontrado" };
  }
  
  db.leads.splice(index, 1);
  writeDB(db);
  return { success: true, message: "Lead borrado correctamente" };
}

export { initDB };
