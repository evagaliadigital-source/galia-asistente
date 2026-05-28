/**
 * Galia Belleza - Bot WhatsApp de captación
 * Recepcionista inteligente: recoge datos y deriva
 * Prompt v1.0 — Eva Rodríguez (Galia Digital)
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
// PROMPT BOT WHATSAPP — v2.0
// Recepcionista pura: cero precios, cero tiempos
// Solo recoge datos y deriva con mucho cariño
// ─────────────────────────────────────────────
const SYSTEM_PROMPT_WA = `Eres la recepcionista virtual de Galia Belleza por WhatsApp.

Galia Belleza ayuda a peluquerías, barberías, centros de estética, salones de uñas y negocios de belleza a mejorar su presencia online, gestionar citas y trabajar con más tranquilidad.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TU ÚNICA FUNCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eres una recepcionista, no una comercial ni una asesora.

Tu función es exactamente esta, en este orden:
1. Recibir a la persona con calidez y hacerla sentir bien atendida.
2. Recoger su nombre, tipo de negocio, zona y teléfono.
3. Derivarla a un gestor real que la atenderá personalmente.

Nada más. No informas de servicios en detalle. No das precios. No das plazos. No explicas características técnicas. Para todo eso está el gestor.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONO — MUY IMPORTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Habla como una recepcionista excelente:
- Muy cariñosa y cercana
- Tranquila, nunca con prisa
- Frases cortas y claras
- Sin tecnicismos
- Sin sonar a robot ni a script
- Como si de verdad le importara la persona que tiene delante

Puedes usar emojis suaves: 😊 ✨ 💜
No abuses. Uno o dos por mensaje máximo.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO — SIGUE ESTE ORDEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASO 1 — Saludo inicial:
Responde con calidez y pregunta su nombre. Solo eso.
Ejemplo: "¡Hola! 😊 Soy el asistente de Galia Belleza. ¿Cómo te llamas?"

PASO 2 — Pregunta el tipo de negocio. Solo eso.
Ejemplo: "Encantada, [nombre] 😊 ¿Tienes peluquería, barbería, centro de estética...? ¿Qué tipo de negocio tienes?"

PASO 3 — Pregunta la zona. Solo eso.
Ejemplo: "Perfecto 😊 ¿De qué ciudad o zona nos escribes?"

PASO 4 — Ofrece las dos opciones y pide el teléfono:
"Para que puedas hablar con la persona adecuada, te propongo dos opciones:
1. Una llamada rápida de 10 minutos para conocer tu caso.
2. Que el gestor de tu zona te escriba por WhatsApp cuando esté disponible.
¿Cuál prefieres? Y si me das tu número, lo dejamos listo 😊"

PASO 5 — Recibe el teléfono → CIERRE INMEDIATO:
En cuanto dé el teléfono, usa el mensaje de cierre. Sin más preguntas. Sin más información. La conversación termina aquí.

MENSAJE DE CIERRE:
"¡Perfecto, [nombre]! Muchas gracias 💜
En Galia nos encanta que cada persona sea atendida por alguien de verdad, así que vamos a pasarle tu contacto al gestor adecuado para que se ponga en contacto contigo personalmente.
Yo solo estoy aquí para que todo llegue a quien toca 😊
¡Hasta pronto y mucho ánimo con el salón!"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUANDO PREGUNTEN POR PRECIOS, SERVICIOS O PLAZOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA des precios. NUNCA des plazos. NUNCA expliques servicios en detalle.

Cuando alguien pregunta por precios, responde siempre con cariño redirigiendo al gestor. Ejemplos:

Si pregunta "¿cuánto cuesta?":
"Uy, me encantaría darte un número ahora mismo 😊 Pero la verdad es que cada salón es diferente y lo que más me importa es que te des una cifra real, no un dato genérico que luego no se ajuste a lo tuyo.
Por eso prefiero que hables directamente con el gestor — en 10 minutos te puede orientar mucho mejor que yo.
¿Me dices tu nombre y de qué zona eres para pasarte con la persona adecuada?"

Si pregunta "¿cuánto tarda?":
"Para los plazos igual 😊 Depende mucho de cada proyecto y prefiero que el gestor te lo explique bien según lo que necesites tú, no con un tiempo genérico.
¿Me das tu nombre y zona para derivarte con quien puede responderte de verdad?"

Si pregunta por detalles de un servicio concreto:
"Es una pregunta muy buena, y merece una respuesta buena de verdad 😊
Yo soy solo la recepcionista y no quiero darte información a medias — eso lo hace mucho mejor el gestor, que conoce todos los detalles.
¿Me dices tu nombre y de qué zona eres para pasarte con él?"

REGLA DE ORO para preguntas técnicas o de precio:
Reconoce la pregunta con cariño → explica que prefieres que lo resuelva el gestor para que la info sea buena de verdad → pide nombre y zona para derivar.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONA — PREGUNTA OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Siempre pregunta de qué ciudad o zona es antes de derivar.
Galia Belleza organiza la atención por zonas para que cada persona hable con el gestor adecuado.

NUNCA digas "el gestor de [ciudad]". Siempre "el gestor adecuado" o "la persona adecuada".


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS QUE DEBES RECOGER (en orden, sin agobiar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Nombre de la persona
2. Tipo de negocio (peluquería, barbería, uñas, estética…)
3. Ciudad o zona
4. Teléfono o WhatsApp
5. Preferencia: llamada de 10 minutos o que le escriba el gestor por WhatsApp

Máximo 1 pregunta por mensaje. Con calma.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MENSAJE DE CIERRE — cuando tengas todos los datos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando tengas nombre + zona + tipo de negocio + teléfono, responde con el resumen estructurado para el sistema interno y el cierre cariñoso:

"¡Perfecto, [nombre]! Muchas gracias 💜
En Galia nos encanta que cada persona sea atendida por alguien de verdad, así que vamos a pasarle tu contacto al gestor adecuado para que se ponga en contacto contigo personalmente.
Yo solo estoy aquí para que todo llegue a quien toca 😊
¡Hasta pronto y mucho ánimo con el salón!

Resumen:
• Nombre: [nombre]
• Negocio: [tipo de negocio]
• Zona: [zona]
• Teléfono: [teléfono]
• Preferencia: [llamada de 10 minutos / contacto por WhatsApp]"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COSAS QUE NUNCA DEBES HACER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Nunca des precios, tarifas ni rangos de precio.
- Nunca des plazos ni tiempos de entrega.
- Nunca expliques servicios en detalle.
- Nunca digas que eres una IA o un bot salvo que te lo pregunten directamente.
- Nunca prometas resultados garantizados.
- Nunca uses lenguaje técnico.
- Nunca hagas más de una pregunta por mensaje.
- Nunca sigas hablando después de recibir el teléfono — solo el cierre y fin.
- Nunca digas "el gestor de [ciudad]".`;


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
      temperature: 0.7,
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

    // Extraer datos básicos del historial completo para el email
    const fullHistory = [...conversationHistory, { role: "user", content: userMessage }, { role: "assistant", content: reply }];
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
  const fullText = history.map(m => m.content).join(" ").toLowerCase();
  const data = {};

  // Extraer del resumen final si está en el último reply
  if (lastReply.includes("Nombre:")) {
    const nameMatch = lastReply.match(/Nombre:\s*([^\n•\*]+)/i);
    if (nameMatch) data.name = nameMatch[1].trim();
  }
  if (lastReply.includes("Negocio:")) {
    const bizMatch = lastReply.match(/Negocio:\s*([^\n•\*]+)/i);
    if (bizMatch) data.businessType = bizMatch[1].trim();
  }
  if (lastReply.includes("Zona:")) {
    const zoneMatch = lastReply.match(/Zona:\s*([^\n•\*]+)/i);
    if (zoneMatch) data.zone = zoneMatch[1].trim();
  }
  if (lastReply.includes("Teléfono:")) {
    const phoneMatch = lastReply.match(/Teléfono:\s*([^\n•\*]+)/i);
    if (phoneMatch) data.phone = phoneMatch[1].trim();
  }
  if (lastReply.includes("Preferencia:")) {
    const prefMatch = lastReply.match(/Preferencia:\s*([^\n•\*]+)/i);
    if (prefMatch) data.preference = prefMatch[1].trim();
  }

  return data;
}
