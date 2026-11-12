import { buildApiUrl } from "./base-url";

export interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

export type SupportFailure = "refusal" | "no_answer" | "unavailable" | "rate_limit" | "daily_limit" | "off";
export type SupportResult = { ok: true } | { ok: false; code: SupportFailure };

/** Splits an SSE body into the JSON payloads of its `data:` lines. */
export function parseSseChunk(buffer: string): { events: Record<string, unknown>[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = blocks
    .flatMap((block) => block.split("\n"))
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
  return { events, rest };
}

export const supportApi = {
  /** Whether the server has the support chat on (a Claude API key configured). */
  async status(): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl("/api/v1/support/status"));
      return response.ok && (await response.json()).enabled === true;
    } catch {
      return false;
    }
  },

  /** Sends the conversation and calls `onText` with each piece of the answer as it arrives. */
  async chat(messages: SupportMessage[], locale: string, onText: (text: string) => void): Promise<SupportResult> {
    let response: Response;
    try {
      response = await fetch(buildApiUrl("/api/v1/support/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, locale }),
      });
    } catch {
      return { ok: false, code: "unavailable" };
    }
    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, code: body?.error?.code === "SUPPORT_DAILY_LIMIT" ? "daily_limit" : "rate_limit" };
    }
    if (response.status === 503) return { ok: false, code: "off" };
    if (!response.ok || !response.body) return { ok: false, code: "unavailable" };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = parseSseChunk(buffer + decoder.decode(value, { stream: true }));
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (event.type === "text" && typeof event.text === "string") onText(event.text);
        if (event.type === "error") {
          const code = event.code === "refusal" || event.code === "no_answer" ? event.code : "unavailable";
          return { ok: false, code };
        }
        if (event.type === "done") return { ok: true };
      }
    }
    // The stream ended without "done": the connection dropped mid-answer.
    return { ok: false, code: "unavailable" };
  },
};
