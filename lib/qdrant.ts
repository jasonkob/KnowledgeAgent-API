import { QdrantClient } from "@qdrant/js-client-rest";

let _client: QdrantClient | null = null;

export function qdrantClient(): QdrantClient | null {
  if (_client) return _client;

  const url = process.env.QDRANT_URL;
  if (!url) return null;

  const normalizedUrl = url.trim().replace(/\/+$/, "");

  _client = new QdrantClient({
    url: normalizedUrl,
    apiKey: process.env.QDRANT_API_KEY || undefined,
  });

  return _client;
}

function formatQdrantError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as unknown as { body?: unknown; response?: unknown; status?: unknown };
    const body = anyErr.body ? ` body=${safeJson(anyErr.body)}` : "";
    const status = anyErr.status ? ` status=${String(anyErr.status)}` : "";
    return `${err.message}${status}${body}`;
  }
  return safeJson(err);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function ensureCollection(name: string, vectorSize: number): Promise<void> {
  const client = qdrantClient();
  if (!client) throw new Error("Qdrant client not configured");

  try {
    await client.getCollection(name);
  } catch {
    // Collection doesn't exist, create it
    try {
      await client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      });
    } catch (err) {
      throw new Error(`Qdrant createCollection failed for "${name}": ${formatQdrantError(err)}`);
    }
  }
}

export async function upsertPoints(
  collectionName: string,
  points: { id: string; vector: number[]; payload: Record<string, unknown> }[]
): Promise<void> {
  const client = qdrantClient();
  if (!client) throw new Error("Qdrant client not configured");

  await client.upsert(collectionName, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  });
}

export async function searchVectors(
  collectionName: string,
  vector: number[],
  limit: number = 10,
  options?: { filter?: Record<string, unknown> }
): Promise<unknown[]> {
  const client = qdrantClient();
  if (!client) throw new Error("Qdrant client not configured");

  const results = await client.search(collectionName, {
    vector,
    limit,
    with_payload: true,
    ...(options?.filter ? { filter: options.filter } : {}),
  });

  return results;
}
