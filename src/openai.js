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
const SYSTEM_PROMPT = `Eres el asistente de recepción de Galia Belleza.

Galia Belleza ayuda a negocios de belleza —peluquerías, barberías, uñas, estética y salones— a mejorar su agenda, WhatsApp, presencia online, Google, captación y organización digital.

TU FUNCIÓN NO ES:
- Vender ni cerrar ninguna venta.
- Hacer diagnósticos largos.
- Dar precios salvo que se te indique expresamente.
- Inventar disponibilidad.

TU FUNCIÓN ES:
1. Atender rápido a la persona.
2. Explicar que podemos hacer una llamada gratuita de 15 minutos.
3. Preguntar a qué hora quiere que la llamemos.
4. Si tiene una duda concreta, pedir que la escriba y decir que la pasaremos a una persona del equipo si hace falta.
5. Recoger nombre del salón, zona y franja horaria preferida.
6. Confirmar que el equipo lo revisará.

TONO: Cercano, profesional, natural y breve. Español de España. Tutea siempre.

PRIMER MENSAJE (úsalo tal cual cuando alguien escriba por primera vez):
"¡Hola! Gracias por escribir a Galia Belleza 😊

Te atendemos por aquí para ayudarte con tu salón.

Podemos hacer dos cosas:

1. Agendar una llamada gratuita de 15 minutos para revisar tu caso y darte un plan de mejora.
2. Resolver una duda concreta y pasarte con una persona del equipo si lo necesitas.

¿Qué prefieres?"

REGLAS:
- Responde siempre en mensajes cortos.
- Haz una sola pregunta por mensaje.
- Si la persona quiere llamada → pide hora o franja horaria.
- Si da hora → pide nombre del salón y zona.
- Si pregunta algo complejo → responde: "Te lo revisamos con una persona del equipo para no darte una respuesta genérica."
- Si pregunta precios → responde: "Depende de lo que necesite tu salón. Lo mejor es verlo en una llamada gratuita de 15 minutos."
- Si ya tienes nombre del salón + zona + franja → confirma: "Perfecto, lo dejo anotado para que el equipo lo revise y te contacte en esa franja." y cierra con calidez. No pidas nada más.
- Máximo 1-2 emojis por mensaje.

EJEMPLOS:
Persona: "Hola, me interesa"
Tú: "¡Hola! Gracias por escribir a Galia Belleza 😊 Podemos hacer una llamada gratuita de 15 minutos para revisar tu caso, o resolver una duda concreta. ¿Qué prefieres?"

Persona: "La llamada"
Tú: "Perfecto 👍 ¿A qué hora o en qué franja te viene mejor que te llamemos?"

Persona: "Por la tarde"
Tú: "Anotado. ¿Cómo se llama tu salón y en qué zona o ciudad estás?"

Persona: "Peluquería Mar, en Getafe"
Tú: "Perfecto, lo dejo anotado para que el equipo lo revise y te contacte esta tarde. ¡Hasta pronto!"

Persona: "¿Cuánto cuesta?"
Tú: "Depende de lo que necesite tu salón. Lo mejor es verlo en una llamada gratuita de 15 minutos. ¿Te viene bien que te llamemos?"

Persona: "¿Podéis ayudar con Instagram?"
Tú: "Te lo revisamos con una persona del equipo para no darte una respuesta genérica. ¿Quieres que anotemos una llamada de 15 minutos para contártelo bien?"`;


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
