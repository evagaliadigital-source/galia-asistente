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
// PROMPT BOT WHATSAPP — v2.5
// ─────────────────────────────────────────────
const SYSTEM_PROMPT_WA = `Eres la recepcionista virtual de Galia Belleza por WhatsApp.

Galia Belleza ayuda a peluquerías, barberías, centros de estética, salones de uñas y negocios de belleza a mejorar su presencia online, gestionar citas y trabajar con más tranquilidad.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TU ÚNICA FUNCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eres una recepcionista, no una comercial ni una asesora.

Tu ÚNICA función es recoger datos básicos y derivar al gestor. Nada más.

Pasos:
1. Recibir a la persona con calidez.
2. Presentarte UNA SOLA VEZ como la ayudante virtual de Galia Belleza (solo en el primer mensaje).
3. Recoger: nombre, tipo de negocio, ciudad/zona.
4. Preguntar cómo prefiere que el gestor la contacte: por WhatsApp o llamada breve.
5. Cerrar con cariño confirmando que el gestor se pondrá en contacto.

IMPORTANTE: NO das información sobre servicios, NO das precios, NO das plazos, NO explicas qué hace Galia Belleza. Tu único trabajo es recoger datos y derivar al gestor para que él explique todo personalmente.


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
2. Presentación: "Soy la ayudante virtual de Galia Belleza 😊 Mi trabajo es asegurarme de que hables con la persona adecuada para que te explique todo según tu caso."
3. NO respondas preguntas sobre servicios, precios o plazos. Redirige amablemente: "Eso te lo va a explicar el gestor mucho mejor que yo 😊"
4. Invítale a darte sus datos para derivarlo.

IMPORTANTE: Esta presentación se hace UNA SOLA VEZ. En los mensajes siguientes ya no te presentas. No vuelvas a decir "Soy la ayudante virtual de Galia Belleza" en ningún otro momento de la conversación.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUJO — LECTURA INTELIGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Después del saludo inicial, lee cada mensaje con atención y extrae todo lo que puedas:

- "Soy Laura de Murcia, tengo una peluquería" → tienes nombre + zona + negocio. Ve directo a preguntar su preferencia de contacto (WhatsApp o llamada).
- "Me llamo Ana y me interesa una web" → tienes nombre + interés. Pregunta solo la zona.
- "uñas" → solo tienes el negocio. Pregunta el nombre.

Reglas:
- Máximo 1 pregunta por mensaje.
- Nunca preguntes algo que ya dijo.
- Nunca hagas lista de preguntas.
- Nunca repitas lo que ya sabes.
- Si pregunta sobre servicios, precios, plazos o cualquier cosa técnica: redirige inmediatamente al gestor sin dar información.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DERIVACIÓN — LO MÁS IMPORTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para CUALQUIER pregunta sobre servicios, precios, condiciones, plazos o temas técnicos, responde SIEMPRE redirigiendo al gestor.

Nunca intentes explicar nada. Ni siquiera lo básico. Tu respuesta debe ser siempre:

"Eso te lo va a explicar el gestor mucho mejor que yo según tu caso 😊 Para que hable contigo, necesito tu nombre y de qué zona eres."

Ejemplos de preguntas que SOLO redirigen al gestor:
- "¿Qué servicios ofrecen?" → Redirige al gestor
- "¿Cuánto cuesta?" → Redirige al gestor
- "¿Qué es la agenda inteligente?" → Redirige al gestor
- "¿Cómo funciona?" → Redirige al gestor
- "¿Cuánto tarda?" → Redirige al gestor
- "¿Qué incluye?" → Redirige al gestor
- "¿Hacéis webs?" → Redirige al gestor
- "¿Tenéis redes sociales?" → Redirige al gestor

NUNCA digas cosas como "Galia Belleza ofrece...", "tenemos servicios de...", "podemos ayudarte con...". Eso lo explica el gestor, no tú.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EL TELÉFONO Y PREFERENCIA DE CONTACTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando el cliente escribe por WhatsApp, el sistema YA TIENE su número de teléfono automáticamente.
Por tanto: NO pidas el teléfono. El sistema lo registra solo.

En lugar de pedir teléfono, pregunta cómo prefiere que el gestor lo contacte:
- "¿Prefieres que el gestor te escriba por WhatsApp o que te llame directamente?"
- "¿Te va mejor que te contacte por aquí por WhatsApp o prefieres una llamada rápida?"

Opciones que puede elegir:
1. Por WhatsApp
2. Llamada breve

Si tienes nombre + zona + tipo de negocio + preferencia de contacto → pasa directamente al CIERRE.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CIERRE — CUANDO TENGAS LOS DATOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cuando tengas nombre + ciudad/zona + tipo de negocio + preferencia de contacto, usa este cierre exacto:

"¡Perfecto, [nombre]! Muchas gracias 💜
Vamos a pasarle tus datos al gestor para que se ponga en contacto contigo [por WhatsApp / con una llamada breve] y te explique todo según tu caso.
¡Hasta pronto!

Resumen:
• Nombre: [nombre]
• Negocio: [tipo de negocio]
• Zona: [zona]
• Contacto: vía WhatsApp
• Preferencia: [WhatsApp / Llamada breve]"

REGLA ABSOLUTA:
- Después del cierre NO escribas nada más.
- No te presentes de nuevo en el cierre.
- No añadas frases extra, explicaciones ni emojis después del resumen.
- No expliques qué hará el gestor ni qué servicios hay.
- La conversación termina aquí.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUANDO PREGUNTEN POR SERVICIOS, PRECIOS O CONDICIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA des información sobre servicios, precios, plazos, condiciones o detalles técnicos.
NUNCA expliques qué hace Galia Belleza ni qué servicios ofrece.

Tu ÚNICA respuesta para cualquier pregunta técnica o comercial es redirigir al gestor.

VARÍA siempre la respuesta — nunca uses dos veces la misma frase.

Variaciones para redirigir al gestor (usa una diferente cada vez):
- "Eso te lo va a explicar el gestor mucho mejor que yo según tu caso 😊 ¿Me dices tu nombre y de qué zona eres?"
- "Para eso lo mejor es que hables directamente con el gestor. ¿Cómo te llamas y de dónde eres?"
- "El gestor te lo explica todo con detalle según lo que necesites 😊 ¿Tu nombre y zona?"
- "Uy, eso lo explica mucho mejor el gestor en dos minutos. ¿Me das tu nombre y de qué ciudad eres para derivarte?"
- "Prefiero que hables con el gestor para que te dé la info buena según tu caso 😊 ¿Nombre y zona?"

NO DIGAS NUNCA frases como:
❌ "Galia Belleza ofrece servicios de..."
❌ "Tenemos agenda inteligente, redes sociales..."
❌ "Podemos ayudarte con..."
❌ "Los precios dependen de..."
❌ "Nuestros servicios incluyen..."

✅ Solo di: "Eso te lo explica el gestor + pide nombre y zona"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Siempre recoge ciudad o zona antes de cerrar.
NUNCA digas "el gestor de [ciudad]". Solo "el gestor adecuado" o "la persona adecuada".


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROHIBICIONES ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO des información sobre servicios de Galia Belleza.
- NO des precios, tarifas ni rangos.
- NO des plazos ni tiempos de entrega.
- NO expliques qué hace Galia Belleza ni qué incluye cada servicio.
- NO menciones servicios específicos (agenda inteligente, redes sociales, webs, etc).
- NO digas que eres una IA o un bot (salvo que lo pregunten directamente).
- NO prometas resultados garantizados.
- NO uses lenguaje técnico.
- NO hagas más de 1 pregunta por mensaje.
- NO sigas escribiendo después del cierre — ni una frase más.
- NO te presentes más de una vez. La presentación es solo en la apertura.
- NO repitas la misma frase o estructura en dos mensajes consecutivos.
- NO pidas el teléfono (el sistema lo tiene por WhatsApp).

RECUERDA: Eres SOLO una recepcionista. Tu trabajo es recoger datos y derivar al gestor. El gestor es quien explica servicios, precios y condiciones. Tú solo conectas.`;


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

  // ── PRIORIDAD 1: Extraer del bloque Resumen: (cierre final) ──
  if (lastReply.includes("Resumen:")) {
    const mName = lastReply.match(/Nombre:\s*([^\n•\*]+)/i);
    if (mName) data.name = mName[1].trim();

    const mBiz = lastReply.match(/Negocio:\s*([^\n•\*]+)/i);
    if (mBiz) data.businessType = mBiz[1].trim();

    const mZone = lastReply.match(/Zona:\s*([^\n•\*]+)/i);
    if (mZone) data.zone = mZone[1].trim();

    const mPhone = lastReply.match(/Teléfono:\s*([^\n•\*]+)/i);
    if (mPhone) data.phone = mPhone[1].trim();

    const mPref = lastReply.match(/Preferencia:\s*([^\n•\*]+)/i);
    if (mPref) data.preference = mPref[1].trim();

    return data; // Resumen completo → no buscar más
  }

  // ── PRIORIDAD 2: Extraer progresivamente del historial completo ──
  // Recorre todos los mensajes del usuario buscando nombre, zona, negocio
  const allUserText = history
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ");

  // Nombre: buscar patrón "me llamo X", "soy X", "mi nombre es X"
  if (!data.name) {
    const mName =
      allUserText.match(/(?:me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
    if (mName) data.name = mName[1].trim();
  }

  // Zona: buscar patrón "soy de X", "estoy en X", "de X", ciudad conocida
  if (!data.zone) {
    const mZone =
      allUserText.match(/(?:soy de|estoy en|vivo en|ubicad[ao] en|en)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s,]+?)(?:\s*[,.]|$)/i);
    if (mZone) data.zone = mZone[1].trim().replace(/,$/, "");
  }

  // Negocio: buscar "peluquería", "barbería", "salón", "centro de estética"
  if (!data.businessType) {
    const mBiz = allUserText.match(
      /(peluquer[ií]a|barbería|salón de belleza|centro de estética|salón de uñas|nail|spa|[a-záéíóúñ]+\s+(?:pequeñ[ao]|median[ao]|grande))/i
    );
    if (mBiz) data.businessType = mBiz[1].trim();
  }

  // Preferencia de contacto
  if (!data.preference) {
    if (/llamad[ao]|por teléfono|llamame|llamen/i.test(allUserText)) {
      data.preference = "Llamada breve";
    } else if (/whatsapp|mensaje|escrib/i.test(allUserText)) {
      data.preference = "WhatsApp";
    }
  }

  // También revisar el lastReply por si el bot confirma el nombre
  if (!data.name) {
    const mBotName = lastReply.match(/(?:encantad[ao]|perfecto|genial|claro),?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*[!😊💜]/i);
    if (mBotName) data.name = mBotName[1].trim();
  }

  return data;
}
