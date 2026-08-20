import { getAnthropicClient } from "./credentials.service.js";
import { getActiveSystemPrompt } from "./systemPrompt.service.js";
import type { messages as messagesTable } from "../db/schema.js";

type HistoryMessage = typeof messagesTable.$inferSelect;

export async function generateReply(history: HistoryMessage[]): Promise<string> {
  const [systemPrompt, { client, model }] = await Promise.all([
    getActiveSystemPrompt(),
    getAnthropicClient(),
  ]);

  const claudeMessages = history
    .filter((m) => m.role !== "system_note")
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}
