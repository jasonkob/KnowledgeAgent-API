import { chatWithLLM } from "@/lib/chat/llm";
import type { ChatLLMConfig } from "@/lib/pipeline/types";

export interface EntityExtractionResult {
  raw: string;
  parsed: Record<string, unknown> | null;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const v = JSON.parse(jsonStr) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeEntityTypes(entityTypes: unknown): string[] {
  if (!Array.isArray(entityTypes)) return [];
  return entityTypes
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

export function buildEntityTags(entities: Record<string, unknown> | null | undefined): string[] {
  if (!entities) return [];
  const tags: string[] = [];

  for (const [type, value] of Object.entries(entities)) {
    const typeNorm = type.trim();
    if (!typeNorm) continue;

    const pushTag = (v: string) => {
      const val = v.trim();
      if (!val) return;
      tags.push(`${typeNorm}:${val}`);
    };

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") pushTag(item);
      }
    } else if (typeof value === "string") {
      pushTag(value);
    }
  }

  return Array.from(new Set(tags));
}

function buildSystemPrompt(): string {
  return [
    "คุณเป็นผู้ช่วยสกัดข้อมูล (entity extraction) ภาษาไทยที่แม่นยำ",
    "ตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่น/markdown)",
    "ถ้าไม่พบให้ส่งอ็อบเจ็กต์ว่าง {}",
  ].join("\n");
}

function buildUserPromptForTypes(entityTypes: string[], text: string): string {
  const types = entityTypes.map((t) => `[${t}]`).join(" ");
  return [
    `จงสกัด entity ตามประเภทต่อไปนี้: ${types}`,
    "\nกติกา:",
    "- ตอบเป็น JSON object เท่านั้น",
    "- key ต้องเป็นชื่อประเภท entity ตามที่ให้มาแบบตรงตัว",
    "- value ของแต่ละ key ต้องเป็น array ของ string (unique, ไม่ต้องเรียง)",
    "- ถ้าไม่พบของประเภทนั้น ให้ใส่ []",
    "\nข้อความ:",
    text,
  ].join("\n");
}

function buildUserPromptLegacy(instruction: string, text: string): string {
  return [
    "จงทำตามคำสั่งด้านล่างและตอบกลับเป็น JSON object เท่านั้น",
    "\nคำสั่ง:",
    instruction,
    "\nข้อความ:",
    text,
  ].join("\n");
}

export async function extractEntitiesFromText(opts: {
  text: string;
  entityTypes?: string[];
  legacyInstructionPrompt?: string;
  llm?: ChatLLMConfig;
}): Promise<EntityExtractionResult> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const llm: ChatLLMConfig = opts.llm || { provider: "openai", model };

  const entityTypes = normalizeEntityTypes(opts.entityTypes);
  const legacy = (opts.legacyInstructionPrompt || "").trim();

  const systemPrompt = buildSystemPrompt();
  const userPrompt =
    entityTypes.length > 0
      ? buildUserPromptForTypes(entityTypes, opts.text)
      : buildUserPromptLegacy(legacy, opts.text);

  const raw = await chatWithLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    llm
  );

  return { raw, parsed: tryParseJsonObject(raw) };
}
