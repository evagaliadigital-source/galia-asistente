/**
 * Galia Belleza - Módulo OpenAI
 * Usa el proxy de Genspark con GSK_API_KEY
 */

import OpenAI from "openai";
import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import path from "path";

// ─────────────────────────────────────────────
// CONFIGURACIÓN — prioridad: GSK_API_KEY > yaml > env
// ─────────────────────────────────────────────
function loadOpenAIConfig() {
  const BASE_URL = "https://www.genspark.ai/api/llm_proxy/v1";

  // 1. GSK_API_KEY es la clave correcta para el proxy de Genspark
  if (process.env.GSK_API_KEY) {
    return { apiKey: process.env.GSK_API_KEY, baseURL: BASE_URL };
  }

  // 2. Leer yaml — expandir ${GENSPARK_TOKEN} si es literal
  const configPath = path.join(os.homedir(), ".genspark_llm.yaml");
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(raw);
      let apiKey = config?.openai?.api_key || "";
      // Expandir referencia literal al token
      if (apiKey.includes("${GENSPARK_TOKEN}")) {
        apiKey = process.env.GSK_API_KEY || process.env.GENSPARK_TOKEN || "";
      }
      if (apiKey && !apiKey.includes("${")) {
        return { apiKey, baseURL: config?.openai?.base_url || BASE_URL };
      }
    } catch (_) {}
  }

  // 3. Fallback a variables de entorno
  return {
    apiKey: process.env.GSK_API_KEY || process.env.GENSPARK_TOKEN || process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || BASE_URL,
  };
}

const { apiKey, baseURL } = loadOpenAIConfig();

const client = new OpenAI({ apiKey, baseURL });

console.log(`🤖 OpenAI proxy | ${baseURL} | key: ${apiKey?.slice(0,12)}...`);

// ─────────────────────────────────────────────
// PROMPT DEL ASISTENTE
// Objetivo único: conseguir hora + salón + zona
// NO vender · NO precios · NO diagnósticos
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente de Galia Belleza.
Tu única función es atender a personas interesadas en una asesoría gratuita para negocios de belleza: peluquerías, barberías, centros de estética, uñas, maquillaje o salones.

OBJETIVO ÚNICO: Conseguir estos tres datos de forma natural: hora o franja preferida para llamada, nombre del salón, y zona o ciudad.

FLUJO EXACTO (sigue este orden siempre):
1. Primer mensaje → Agradece brevemente. Di que la asesoría es gratuita, dura 15 minutos y que le daréis un plan de mejora sencillo. Pregunta: ¿a qué hora le viene mejor que le llamemos hoy o mañana?
2. Si da hora o franja (ej: "por la tarde", "a las 11", "mañana") → Confirma con "perfecto" y pide nombre del salón y en qué zona o ciudad está.
3. Si ya tienes los tres datos → Confirma que ya lo has pasado al equipo y que le llamarán en esa franja. Cierra con calidez. No pidas nada más.

REGLAS ABSOLUTAS:
- Máximo 2-3 frases por respuesta. NUNCA más.
- No vendas. No menciones precios. No expliques servicios.
- No prometas resultados específicos ni garantices nada.
- No inventes horarios concretos disponibles.
- Si te preguntan algo fuera del tema → responde en una frase y vuelve a pedir la hora.
- Si no saben cuándo → ofrece: mañana (9h-12h), mediodía (12h-15h) o tarde (15h-19h).
- Tutea siempre. Español de España. Tono cercano y natural.
- Máximo 1-2 emojis por mensaje, nunca más.

EJEMPLOS:
Persona: "Hola, me interesa la asesoría"
Tú: "¡Genial, gracias por escribir! 😊 La asesoría es gratuita y dura unos 15 minutos — echamos un vistazo a tu salón y te damos un plan sencillo para saber por dónde empezar. ¿A qué hora te viene mejor que te llamemos, hoy o mañana?"

Persona: "Por la tarde mejor"
Tú: "Perfecto, tarde anotado 👍 ¿Cómo se llama tu salón y en qué zona o ciudad estás?"

Persona: "Peluquería Lucía, en Alcorcón"
Tú: "¡Listo! Ya lo paso al equipo con todos los datos. Os llamaremos esta tarde sin falta. ¡Hasta pronto!"

Persona: "¿Cuánto cuesta?"
Tú: "La asesoría es completamente gratuita, sin compromiso. ¿A qué hora te viene bien que te llamemos?"`;

/**
 * Genera respuesta del asistente con historial de conversación.
 * @param {Array} conversationHistory - [{role: "user"|"assistant", content: string}]
 * @param {string} userMessage - Último mensaje del usuario
 * @returns {Promise<string>}
 */
export async function generateLeadReply(conversationHistory = [], userMessage) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,  // gpt-5-mini usa reasoning tokens internamente
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content?.trim();
    console.log(`💬 Usuario: "${userMessage.slice(0,50)}" → Bot: "${reply?.slice(0,80)}"`);
    return reply;
  } catch (error) {
    console.error("❌ Error OpenAI:", error.status || "", error.message);
    return "¡Gracias por escribirnos! En este momento tenemos un pequeño problema técnico. Te contestamos en seguida 🙏";
  }
}
