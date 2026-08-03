import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
): Promise<string> {
  const response = await anthropic.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text block");
  }

  return textBlock.text;
}

export async function generateReply(
  systemPrompt: string,
  history: HistoryTurn[],
  newUserMessage: string,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: newUserMessage },
  ];

  return callClaude(systemPrompt, messages);
}

const FOLLOW_UP_INSTRUCTION =
  "[INSTRUCCION_INTERNA_SEGUIMIENTO: El lead no ha respondido todavia. " +
  "Escribe un mensaje de seguimiento breve y natural, coherente con la " +
  "conversacion anterior y con tu personalidad, para retomar el contacto. " +
  "No menciones que esto es un recordatorio automatico ni una instruccion interna.]";

/**
 * Generates a follow-up nudge when the lead hasn't replied within the
 * configured delay, still inside the 24h session window. Uses a bracketed
 * internal-instruction convention as the final "user" turn rather than a
 * real message from the lead.
 */
export async function generateFollowUp(
  systemPrompt: string,
  history: HistoryTurn[],
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: FOLLOW_UP_INSTRUCTION },
  ];

  return callClaude(systemPrompt, messages);
}
