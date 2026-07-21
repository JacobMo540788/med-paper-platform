import { sleep } from "../utils";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

function getLlmConfig() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      base: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",
      key: deepseekKey,
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      provider: "DeepSeek",
    };
  }

  return {
    base: process.env.LLM_API_BASE ?? "https://api.deepseek.com",
    key: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    provider: process.env.LLM_API_BASE?.includes("openrouter") ? "OpenRouter" : "OpenAI-compatible",
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const { base, key, model, provider } = getLlmConfig();
  if (!key) throw new Error("LLM_API_KEY or DEEPSEEK_API_KEY is not configured.");

  const timeoutMs = options?.timeoutMs ?? 120_000;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": "MedFrontier",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 2048,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error(`${provider} returned an empty response.`);
        return content;
      }

      const errText = await res.text();
      lastError = new Error(`${provider} API error ${res.status}: ${errText}`);
      if (![429, 500, 502, 503, 504].includes(res.status)) break;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep((attempt + 1) * 1500);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Unable to parse LLM JSON.");
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}
