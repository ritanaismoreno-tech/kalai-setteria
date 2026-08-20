import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { trainingMessages } from "../db/schema.js";
import { getProgramConfig, SECTION_KEYS } from "./onboarding.service.js";
import { getAnthropicClient } from "./credentials.service.js";

// Tope de conversaciones reales por categoría que se envían al análisis: más
// allá de esto no gana calidad y sí dispara el costo/tamaño de la llamada.
const MAX_CONVERSATIONS_PER_OUTCOME = 40;

interface ConversationTranscript {
  leadName: string;
  outcome: string;
  lines: string[];
}

async function sampleConversations(outcome: "reached_call" | "not_scheduled"): Promise<ConversationTranscript[]> {
  const rows = await db
    .select()
    .from(trainingMessages)
    .where(eq(trainingMessages.outcome, outcome))
    .orderBy(trainingMessages.leadName, trainingMessages.messageDate);

  const byLead = new Map<string, ConversationTranscript>();
  for (const row of rows) {
    const key = row.leadName;
    if (!byLead.has(key)) byLead.set(key, { leadName: key, outcome, lines: [] });
    const who = row.sentBy || (row.direction === "inbound" ? "Lead" : "Setter");
    byLead.get(key)!.lines.push(`${who}: ${row.messageText}`);
  }

  return [...byLead.values()]
    .sort((a, b) => b.lines.length - a.lines.length)
    .slice(0, MAX_CONVERSATIONS_PER_OUTCOME);
}

function formatProgramConfig(config: Record<string, unknown>): string {
  const sectionTitles: Record<string, string> = {
    producto: "Producto / Programa",
    objetivoIa: "Objetivo de la IA",
    links: "Links / Cierre",
    personalidad: "Personalidad",
    objeciones: "Objeciones",
    clientes: "Clientes existentes",
    equipo: "Equipo",
    testimonios: "Testimonios",
    formato: "Ajustes de formato",
    followUps: "Follow-ups",
  };

  return SECTION_KEYS.map((key) => {
    const data = config[key];
    if (!data || Object.keys(data).length === 0) return null;
    const fields = Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([field, value]) => `- ${field}: ${value}`)
      .join("\n");
    if (!fields) return null;
    return `### ${sectionTitles[key]}\n${fields}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

function formatConversations(transcripts: ConversationTranscript[], label: string): string {
  if (transcripts.length === 0) return `(No se subieron conversaciones de tipo "${label}")`;

  return transcripts
    .map((t, i) => `--- Conversación ${i + 1} (${t.leadName}) ---\n${t.lines.join("\n")}`)
    .join("\n\n");
}

export async function generateSystemPromptDraft(): Promise<string> {
  const config = await getProgramConfig();
  const [reached, notScheduled] = await Promise.all([
    sampleConversations("reached_call"),
    sampleConversations("not_scheduled"),
  ]);

  const configText = formatProgramConfig(config as unknown as Record<string, unknown>);
  const hasConversations = reached.length > 0 || notScheduled.length > 0;

  const userPrompt = `Vas a escribir el system prompt final para un setter de IA que responde por WhatsApp/Instagram a nombre de un negocio real, cualificando leads.

# Respuestas del formulario de configuración (lo que el dueño del negocio escribió sobre su programa)

${configText || "(el formulario todavía no tiene contenido)"}

${
  hasConversations
    ? `# Conversaciones reales de su equipo de setters humanos, como referencia de tono y forma de trabajar

## Conversaciones que SÍ llegaron a agendar una llamada
${formatConversations(reached, "llegó a llamada")}

## Conversaciones que NO llegaron a agendar
${formatConversations(notScheduled, "no llegó a agendar")}

Analiza estas conversaciones reales para extraer: tono exacto, vocabulario propio de la marca, expresiones que se repiten, cómo cualifican, cómo manejan objeciones, y en las que no llegaron a agendar, qué patrones llevan al lead a desengancharse (para que la IA los evite o los maneje mejor).`
    : `No se subieron conversaciones reales de referencia todavía — escribe el system prompt basándote únicamente en las respuestas del formulario de arriba.`
}

# Qué debes entregar

Escribe el system prompt completo, listo para usarse tal cual (no un resumen ni una lista de recomendaciones). Debe incluir: quién es la IA y a nombre de quién habla, el objetivo de cada conversación, cómo cualificar al lead, tono y vocabulario a usar (y qué evitar), cómo manejar objeciones frecuentes, cuándo y cómo proponer la llamada, y qué hacer con clientes existentes. Escribe en español, en segunda persona dirigida a la propia IA (ej. "Eres..., tu objetivo es..."). No incluyas explicaciones tuyas antes o después del prompt — solo el prompt en sí.`;

  const { client, model } = await getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
