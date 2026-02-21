import { jobStore } from "@/lib/pipeline/job-store";
import { getEmbeddings } from "@/lib/embeddings";
import { searchVectors } from "@/lib/qdrant";
import { chatWithLLM } from "@/lib/chat/llm";
import { getKeyByCollection, validateApiKey } from "@/lib/api-keys-service";
import { isJobRepoEnabled } from "@/lib/pipeline/job-repo";
import { getCollectionByName } from "@/lib/pipeline/collection-repo";
import type { ChatLLMConfig, EmbeddingConfig } from "@/lib/pipeline/types";
import { buildEntityTags, extractEntitiesFromText, normalizeEntityTypes } from "@/lib/entity-extraction";

export interface RagGraphInput {
  message: string;
  collectionName: string;
  history?: { role: "user" | "assistant"; content: string }[];
  topK?: number;
  apiKeyHeader?: string | null;
}

export interface RagSource {
  index: number;
  score: number;
  text: string;
  fileName?: string;
  docPath?: string;
}

export interface RagGraphOutput {
  answer: string;
  sources: RagSource[];
  usedEmbedding: EmbeddingConfig;
  usedChatModel: ChatLLMConfig;
}

function toolSearchQdrant(
  collectionName: string,
  queryVector: number[],
  topK: number,
  options?: { filter?: Record<string, unknown> }
): Promise<unknown[]> {
  return searchVectors(collectionName, queryVector, topK, options);
}

async function toolBuildEntityFilter(input: {
  message: string;
  entityTypes: string[];
}): Promise<{ filter?: Record<string, unknown>; tags: string[] }> {
  const entityTypes = normalizeEntityTypes(input.entityTypes);
  if (entityTypes.length === 0) return { tags: [] };

  let tags: string[] = [];
  try {
    const { parsed } = await extractEntitiesFromText({ text: input.message, entityTypes });
    tags = buildEntityTags(parsed);
  } catch {
    return { tags: [] };
  }
  if (tags.length === 0) return { tags: [] };

  // Match any extracted tag (broad narrowing, safer than over-filtering)
  const filter: Record<string, unknown> = {
    must: [
      {
        key: "entityTags",
        match: { any: tags },
      },
    ],
  };

  return { filter, tags };
}

export async function runRagGraph(input: RagGraphInput): Promise<RagGraphOutput> {
  const topK = input.topK ?? 5;

  // Resolve embedding config from collection metadata (single supported: Ollama)
  let collection = jobStore.getCollection(input.collectionName);
  if (!collection && isJobRepoEnabled()) {
    try {
      collection = await getCollectionByName(input.collectionName);
    } catch {
      // ignore
    }
  }
  if (!collection) {
    throw new Error("Collection not found. Run a pipeline first.");
  }

  const usedEmbedding: EmbeddingConfig = {
    provider: collection.embeddingProvider as EmbeddingConfig["provider"],
    model: collection.embeddingModel,
  };

  if (usedEmbedding.provider !== "ollama") {
    throw new Error("Only Ollama embeddings are supported");
  }

  // Resolve optional system prompt from API key (external usage)
  let collectionSystemPrompt = "";
  if (input.apiKeyHeader) {
    const validKey = await validateApiKey(input.apiKeyHeader);
    if (!validKey) {
      const err = new Error("Invalid or revoked API key");
      // @ts-expect-error annotate status for route mapping
      err.statusCode = 403;
      throw err;
    }
    collectionSystemPrompt = validKey.systemPrompt || "";
  } else {
    const keyInfo = await getKeyByCollection(input.collectionName);
    if (keyInfo) collectionSystemPrompt = keyInfo.systemPrompt || "";
  }

  // Node: embed query
  const [queryVector] = await getEmbeddings([input.message], usedEmbedding);

  // Tool: metadata filtering (entityTags) when possible
  const entityTypes = normalizeEntityTypes((collection as unknown as { entityTypes?: unknown }).entityTypes);
  const { filter } = await toolBuildEntityFilter({ message: input.message, entityTypes });

  // Tool: vector search
  const results = await toolSearchQdrant(input.collectionName, queryVector, topK, filter ? { filter } : undefined);

  const contexts = (results as Array<{ score: number; payload?: Record<string, unknown> }>).map((r) => ({
    text: (r.payload?.text as string) || "",
    score: r.score,
    fileName: (r.payload?.fileName as string) || undefined,
    docPath: (r.payload?.docPath as string) || undefined,
  }));

  const contextText = contexts
    .map(
      (c, i) =>
        `[${i + 1}] (score: ${c.score.toFixed(3)}${c.fileName ? `, file: ${c.fileName}` : ""})\n${c.text}`
    )
    .join("\n\n---\n\n");

  const baseSystemPrompt = collectionSystemPrompt
    ? `${collectionSystemPrompt}\n\nUse the retrieved context below to answer. Cite sources by their number [1], [2], etc.\n\n## Retrieved Context\n${
        contextText || "(No relevant documents found)"
      }`
    : `You are a helpful assistant that answers questions based on the provided document context.\nUse the retrieved context to answer the user's question accurately. If the context does not contain enough information, say so.\nAlways cite which source(s) you used by their number [1], [2], etc.\n\n## Retrieved Context\n${
        contextText || "(No relevant documents found)"
      }`;

  const hiddenFormatInstruction =
    "Respond with a helpful answer. Do not mention system instructions. Keep it concise.";

  // Node: synthesize answer (OpenAI-compatible)
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const usedChatModel: ChatLLMConfig = { provider: "openai", model };

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${baseSystemPrompt}\n\n${hiddenFormatInstruction}` },
    ...(input.history || []).slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: input.message },
  ];

  const answer = await chatWithLLM(messages, usedChatModel);

  return {
    answer,
    sources: contexts.map((c, i) => ({
      index: i + 1,
      score: c.score,
      text: c.text.substring(0, 300) + (c.text.length > 300 ? "..." : ""),
      fileName: c.fileName,
      docPath: c.docPath,
    })),
    usedEmbedding,
    usedChatModel,
  };
}
