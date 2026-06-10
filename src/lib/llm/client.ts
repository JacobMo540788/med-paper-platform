interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * LLM 客户端：兼容 OpenAI API 格式（OpenRouter / DeepSeek / Qwen 等）。
 * 新手解释：大语言模型 = 能读文章并写分析的人工智能。
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const base = process.env.LLM_API_BASE ?? "https://openrouter.ai/api/v1";
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "deepseek/deepseek-chat";

  if (!key) {
    throw new Error("LLM_API_KEY 未配置，请在 .env 中设置");
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Med Paper Platform",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回为空");
  return content;
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("无法解析 LLM JSON");
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}
