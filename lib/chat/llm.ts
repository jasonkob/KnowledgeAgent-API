import type { ChatLLMConfig } from "@/lib/pipeline/types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenAI(
  messages: ChatMessage[],
  model: string
): Promise<string> {
  const baseUrlRaw = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  const apiKey = process.env.OPENAI_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey.trim().length > 0) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

export async function chatWithLLM(
  messages: ChatMessage[],
  config: ChatLLMConfig
): Promise<string> {
  if (config.provider !== "openai") {
    throw new Error("Only OpenAI-compatible chat is supported");
  }
  return callOpenAI(messages, config.model);
}
