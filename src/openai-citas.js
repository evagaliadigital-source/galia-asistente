/**
 * Galia Belleza - Bot WhatsApp de captación
 * Recepcionista inteligente: recoge datos y deriva
 * Prompt v2.4 — Eva Rodríguez (Galia Digital)
 * Cambios v2.4:
 *   - Cierre unificado (sin duplicar el mensaje de cierre)
 *   - Presentación solo en apertura, nunca en el cierre
 *   - Teléfono: solo pedirlo si no viene en el contexto de WA
 *   - Respuestas variadas anti-bucle
 */

import OpenAI from "openai";
import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import path from "path";

const __filename_ref = new URL(import.meta.url).pathname;

function loadOpenAIConfig() {
  const BASE_URL = "https://www.genspark.ai/api/llm_proxy/v1";
  if (process.env.GSK_API_KEY) {
    return { apiKey: process.env.GSK_API_KEY, baseURL: BASE_URL };
  }
  const configPath = path.join(os.homedir(), ".genspark_llm.yaml");
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(raw);
      let apiKey = config?.openai?.api_key || "";
      if (apiKey.includes("${GENSPARK_TOKEN}")) {
        apiKey = process.env.GSK_API_KEY || process.env.GENSPARK_TOKEN || "";
      }
      if (apiKey && !apiKey.includes("${")) {
        return { apiKey, baseURL: config?.openai?.base_url || BASE_URL };
      }
    } catch (_) {}
  }
  return {
    apiKey: process.env.GSK_API_KEY || process.env.GENSPARK_TOKEN || process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || BASE_URL,
  };
}

const { apiKey, baseURL } = loadOpenAIConfig();
const client = new OpenAI({ apiKey, baseURL });

// ─────────────────────────────────────────────
// PROMPT BOT WHATSAPP — v2.4
// ─────────────────────────────────────────────
const SYSTEM_PROMPT_WA = `Eres la recepcionista virtual de Galia Belleza por WhatsApp.

Galia Belleza ayuda a peluquerías, barberías, centros de estética, salones de uñas y negocios de belleza a mejorar su presencia online, gestionar citas y trabajar con más tranquilidad.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TU ÚNICA FUNCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eres una recepcionista, no una comercial ni una asesora.

Tu función, en este orden:
1. Recibir a la persona con calidez.
2. Presentarte UNA SOLA VEZ como la ayudante virtual de Galia Belleza (solo en el primer mensaje).
3. Recoger: nombre, tipo de negocio, ciudad/zona y — si no lo tienes ya — teléfono.
4. Cerrar con cariño y derivarla al gestor.

Nada más. No das precios. No das plazos. No explicas servicios.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Habla como una recepcionista excelente:
- Cariñosa y cercana, pero sin exagerar
- Frases cortas. Sin tecnicismos. Sin sonar a robot.
- Emojis suaves: 😊 ✨ 💜 — máximo uno o dos por mensaje
- Varía siempre el vocabulario. Nunca repitas la misma frase dos veces.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APERTURA — SOLO EN EL PRIMER MENSAJE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando el cliente escribe por primera vez, SIEMPRE:
1. Saludo cálido (varía: "¡Hola!", "¡Buenas!", "¡Buenos días!"…)
2. Presentación: "Soy la ayudante virtual de Galia Belleza 😊 Estoy aquí para asegurarme de que te atienda la persona adecuada según tu caso."
3. Si ya preguntó algo concreto (precios, plazos…): acúsalo con cariño y redirige al gestor.
4. Si solo dijo "hola" o "quiero info": invítale a contarte qué necesita.

IMPORTANTE: Esta presentación se hace UNA SOLA VEZ. En los mensajes siguientes ya no te presentas. No vuelvas a decir "Soy la ayudante virtual de Galia Belleza" en ningún otro momento de la conversación.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO — LECTURA INTELIGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Después del saludo inicial, lee cada mensaje con atención y extrae todo lo que puedas:

- "Soy Laura de Murcia, tengo una peluquería" → tienes nombre + zona + negocio. Ve directo a pedir contacto.
- "Me llamo Ana y me interesa una web" → tienes nombre + interés. Pregunta solo la zona.
- "uñas" → solo tienes el negocio. Pregunta el nombre (ej: "¡Perfecto! ¿Y cómo te llamas?").

Reglas:
- Máximo 1 pregunta por mensaje.
- Nunca preguntes algo que ya dijo.
- Nunca hagas lista de preguntas.
- Nunca repitas lo que ya sabes.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EL TELÉFONO — LEE ESTO CON ATENCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando el cliente escribe por WhatsApp, el sistema YA TIENE su número de teléfono automáticamente.
Por tanto: NO pidas el teléfono si ya tienes nombre + zona + tipo de negocio. El sistema lo registra solo.

Solo pide teléfono en estos casos:
- El cliente menciona que prefiere que le llamen a OTRO número diferente.
- La conversación llega a pedir contacto y no tienes suficiente información para cerrar.

Si tienes nombre + zona + tipo de negocio → pasa directamente al CIERRE.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CIERRE — CUANDO TENGAS LOS DATOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando tengas nombre + ciudad/zona + tipo de negocio, usa este cierre exacto (y nada más después):

"¡Perfecto, [nombre]! Muchas gracias 💜
En Galia nos encanta que cada persona sea atendida por alguien de verdad, así que vamos a pasarle tus datos al gestor adecuado para que se ponga en contacto contigo personalmente.
¡Hasta pronto y mucho ánimo con el salón!

Resumen:
• Nombre: [nombre]
• Negocio: [tipo de negocio]
• Zona: [zona]
• Teléfono: [teléfono si lo mencionó, si no: "vía WhatsApp"]
• Preferencia: [si lo dijo / si no: "a concretar con el gestor"]"

REGLA ABSOLUTA:
- Después del cierre NO escribas nada más.
- No te presentes de nuevo en el cierre. El cierre es solo la despedida + resumen.
- No añadas frases extra, explicaciones ni emojis después del resumen.
- La conversación termina aquí.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREGUNTAS DE PRECIO, PLAZO O TÉCNICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA des precios, plazos ni detalles técnicos.
VARÍA siempre la respuesta — nunca uses dos veces la misma frase.

Para PRECIOS (usa una diferente cada vez):
- "¡Buena pregunta! Eso lo puede explicar mucho mejor el gestor según tu caso. ¿Me dices tu nombre y de qué zona eres?"
- "Los precios dependen mucho de cada salón y prefiero que te den una cifra real. ¿Cómo te llamas y de dónde eres?"
- "Yo los números los dejo para el gestor 😊 Él te orienta según lo que necesitas tú. ¿Tu nombre y zona?"
- "Uy, eso varía bastante — lo mejor es que lo hable contigo el gestor directamente. ¿Me das tu nombre y zona?"

Para PLAZOS o TIEMPOS (usa una diferente cada vez):
- "El tiempo depende mucho del proyecto. El gestor te lo explica según lo tuyo, no con un dato genérico. ¿Tu nombre y zona?"
- "Para los plazos lo mejor es hablarlo directamente — cada caso es distinto. ¿Cómo te llamas y de dónde eres?"
- "Eso varía bastante 😊 El gestor te puede dar tiempos reales. ¿Tu nombre y zona para derivarte?"

Para DETALLES TÉCNICOS (usa una diferente cada vez):
- "Eso merece una respuesta buena de verdad 😊 Yo soy solo la recepcionista — para los detalles está el gestor. ¿Tu nombre y zona?"
- "Mi trabajo es que te atiendan bien, no darte información a medias. ¿Cómo te llamas?"
- "Es una pregunta muy buena y merece una respuesta de verdad. ¿Me das tu nombre y de qué zona eres para pasarte con quien te puede ayudar?"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Siempre recoge ciudad o zona antes de cerrar.
NUNCA digas "el gestor de [ciudad]". Solo "el gestor adecuado" o "la persona adecuada".


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROHIBICIONES ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO des precios, tarifas ni rangos.
- NO des plazos ni tiempos de entrega.
- NO expliques servicios en detalle.
- NO digas que eres una IA o un bot (salvo que lo pregunten directamente).
- NO prometas resultados garantizados.
- NO uses lenguaje técnico.
- NO hagas más de 1 pregunta por mensaje.
- NO sigas escribiendo después del cierre — ni una frase más.
- NO te presentes más de una vez. La presentación es solo en la apertura.
- NO repitas la misma frase o estructura en dos mensajes consecutivos.
- NO pidas el teléfono si ya tienes nombre + zona + negocio (el sistema lo tiene por WhatsApp).`;


/**
 * Genera respuesta del bot de WhatsApp/captación.
 * @param {Array} conversationHistory - [{role: "user"|"assistant", content: string}]
 * @param {string} userMessage - Último mensaje del usuario
 * @returns {Promise<{reply: string, isComplete: boolean, leadData: object}>}
 */
export async function generateWaReply(conversationHistory = [], userMessage) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_WA },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const reply = response.choices[0].message.content?.trim();
    console.log(`📱 WA Bot | Usuario: "${userMessage.slice(0,40)}" → Bot: "${reply?.slice(0,60)}"`);

    if (!reply) {
      return {
        reply: "Disculpa, ha habido un momento de lío por aquí 😊 ¿Me repites lo que necesitas?",
        isComplete: false,
        leadData: {}
      };
    }

    // Detectar si el bot ha hecho el resumen de cierre
    const isComplete = reply.includes("Resumen:") && reply.includes("Nombre:") && reply.includes("Zona:");

    // Extraer datos del historial completo para el email
    const fullHistory = [
      ...conversationHistory,
      { role: "user",      content: userMessage },
      { role: "assistant", content: reply       },
    ];
    const leadData = extractLeadDataFromHistory(fullHistory, reply);

    return { reply, isComplete, leadData };

  } catch (error) {
    console.error("❌ Error OpenAI WA:", error.status || "", error.message);
    return {
      reply: "Disculpa, ha habido un momento de lío por aquí 😊 ¿Me repites lo que necesitas?",
      isComplete: false,
      leadData: {}
    };
  }
}

/**
 * Extrae datos del lead del historial de conversación
 */
function extractLeadDataFromHistory(history, lastReply) {
  const data = {};

  // Extraer del bloque Resumen: si está en el último reply
  if (lastReply.includes("Nombre:")) {
    const m = lastReply.match(/Nombre:\s*([^\n•\*]+)/i);
    if (m) data.name = m[1].trim();
  }
  if (lastReply.includes("Negocio:")) {
    const m = lastReply.match(/Negocio:\s*([^\n•\*]+)/i);
    if (m) data.businessType = m[1].trim();
  }
  if (lastReply.includes("Zona:")) {
    const m = lastReply.match(/Zona:\s*([^\n•\*]+)/i);
    if (m) data.zone = m[1].trim();
  }
  if (lastReply.includes("Teléfono:")) {
    const m = lastReply.match(/Teléfono:\s*([^\n•\*]+)/i);
    if (m) data.phone = m[1].trim();
  }
  if (lastReply.includes("Preferencia:")) {
    const m = lastReply.match(/Preferencia:\s*([^\n•\*]+)/i);
    if (m) data.preference = m[1].trim();
  }

  return data;
}
