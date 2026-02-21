import type { CollectionInfo } from "./job-store";
import { getMysqlPool } from "../mysql";
import type { RowDataPacket } from "mysql2/promise";

const TABLE = "pipeline_collections";

export async function upsertCollection(info: CollectionInfo): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;

  try {
    await pool.execute(
      `INSERT INTO ${TABLE} (
          name,
          embedding_provider,
          embedding_model,
          dimensions,
          document_count,
          vector_count,
          created_at_ms,
          last_updated_ms,
          pipeline_ids_json,
          entity_types_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          embedding_provider = VALUES(embedding_provider),
          embedding_model = VALUES(embedding_model),
          dimensions = VALUES(dimensions),
          document_count = VALUES(document_count),
          vector_count = VALUES(vector_count),
          last_updated_ms = VALUES(last_updated_ms),
          pipeline_ids_json = VALUES(pipeline_ids_json),
          entity_types_json = VALUES(entity_types_json)`,
      [
        info.name,
        info.embeddingProvider,
        info.embeddingModel,
        info.dimensions,
        info.documentCount,
        info.vectorCount,
        info.createdAt,
        info.lastUpdated,
        JSON.stringify(info.pipelineIds ?? []),
        JSON.stringify(info.entityTypes ?? []),
      ]
    );
  } catch (err) {
    // Backward-compat: older schemas might not have entity_types_json.
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("entity_types_json")) throw err;

    await pool.execute(
      `INSERT INTO ${TABLE} (
          name,
          embedding_provider,
          embedding_model,
          dimensions,
          document_count,
          vector_count,
          created_at_ms,
          last_updated_ms,
          pipeline_ids_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          embedding_provider = VALUES(embedding_provider),
          embedding_model = VALUES(embedding_model),
          dimensions = VALUES(dimensions),
          document_count = VALUES(document_count),
          vector_count = VALUES(vector_count),
          last_updated_ms = VALUES(last_updated_ms),
          pipeline_ids_json = VALUES(pipeline_ids_json)`,
      [
        info.name,
        info.embeddingProvider,
        info.embeddingModel,
        info.dimensions,
        info.documentCount,
        info.vectorCount,
        info.createdAt,
        info.lastUpdated,
        JSON.stringify(info.pipelineIds ?? []),
      ]
    );
  }
}

export async function getCollectionByName(name: string): Promise<CollectionInfo | undefined> {
  const pool = getMysqlPool();
  if (!pool) return undefined;

  const [rows] = await pool.query<
    (RowDataPacket & {
      name: string;
      embedding_provider: string;
      embedding_model: string;
      dimensions: number;
      document_count: number;
      vector_count: number;
      created_at_ms: number;
      last_updated_ms: number;
      pipeline_ids_json: string;
      entity_types_json?: string;
    })[]
  >(
    `SELECT * FROM ${TABLE} WHERE name = ? LIMIT 1`,
    [name]
  );

  const r = rows[0];
  if (!r) return undefined;

  let pipelineIds: string[] = [];
  try {
    pipelineIds = JSON.parse(r.pipeline_ids_json || "[]");
  } catch {
    pipelineIds = [];
  }

  let entityTypes: string[] = [];
  try {
    entityTypes = JSON.parse((r.entity_types_json as string) || "[]");
  } catch {
    entityTypes = [];
  }

  return {
    name: r.name,
    embeddingProvider: r.embedding_provider,
    embeddingModel: r.embedding_model,
    dimensions: Number(r.dimensions),
    documentCount: Number(r.document_count),
    vectorCount: Number(r.vector_count),
    createdAt: Number(r.created_at_ms),
    lastUpdated: Number(r.last_updated_ms),
    pipelineIds,
    entityTypes,
  };
}

export async function listCollections(limit = 200): Promise<CollectionInfo[]> {
  const pool = getMysqlPool();
  if (!pool) return [];

  const [rows] = await pool.query<
    (RowDataPacket & {
      name: string;
      embedding_provider: string;
      embedding_model: string;
      dimensions: number;
      document_count: number;
      vector_count: number;
      created_at_ms: number;
      last_updated_ms: number;
      pipeline_ids_json: string;
      entity_types_json?: string;
    })[]
  >(
    `SELECT * FROM ${TABLE} ORDER BY last_updated_ms DESC LIMIT ?`,
    [Math.max(1, Math.min(500, limit))]
  );

  return rows
    .map((r) => {
      let pipelineIds: string[] = [];
      try {
        pipelineIds = JSON.parse(r.pipeline_ids_json || "[]");
      } catch {
        pipelineIds = [];
      }

      let entityTypes: string[] = [];
      try {
        entityTypes = JSON.parse((r.entity_types_json as string) || "[]");
      } catch {
        entityTypes = [];
      }
      return {
        name: r.name,
        embeddingProvider: r.embedding_provider,
        embeddingModel: r.embedding_model,
        dimensions: Number(r.dimensions),
        documentCount: Number(r.document_count),
        vectorCount: Number(r.vector_count),
        createdAt: Number(r.created_at_ms),
        lastUpdated: Number(r.last_updated_ms),
        pipelineIds,
        entityTypes,
      };
    })
    .filter(Boolean);
}
