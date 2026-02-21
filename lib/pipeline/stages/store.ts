import { jobStore } from "../job-store";
import { qdrantClient, ensureCollection, upsertPoints } from "../../qdrant";
import type { EmbeddedChunk } from "./embed";
import type { EmbeddingConfig } from "../types";
import { buildDocPath } from "../document-store";
import { buildEntityTags, normalizeEntityTypes } from "@/lib/entity-extraction";

export async function runStoreStage(
  jobId: string,
  chunks: EmbeddedChunk[],
  collectionName: string,
  fileName: string,
  embeddingConfig?: EmbeddingConfig,
  systemPrompt?: string,
  entityTypes?: string[]
): Promise<void> {
  if (chunks.length === 0) {
    jobStore.addLog(jobId, "store", "No chunks to store, skipping");
    jobStore.updateStage(jobId, "store", {
      output: { stored: 0 },
    });
    return;
  }

  const dimensions = chunks[0].vector.length;
  jobStore.addLog(jobId, "store", `Target collection: ${collectionName}`);
  jobStore.addLog(jobId, "store", `Vector dimensions: ${dimensions}`);

  // Check Qdrant connection
  try {
    const client = qdrantClient();
    if (!client) {
      jobStore.addLog(jobId, "store", "Qdrant not configured - storing results in memory only", "warn");
      jobStore.updateStage(jobId, "store", {
        output: {
          stored: chunks.length,
          mode: "dry-run",
          reason: "Qdrant not configured",
        },
      });
      return;
    }
  } catch (err) {
    jobStore.addLog(jobId, "store", `Qdrant connection check failed: ${err instanceof Error ? err.message : "unknown"}`, "warn");
    jobStore.updateStage(jobId, "store", {
      output: {
        stored: chunks.length,
        mode: "dry-run",
        reason: "Qdrant connection failed",
      },
    });
    return;
  }

  // Ensure collection exists
  jobStore.addLog(jobId, "store", `Ensuring collection "${collectionName}" exists...`);
  await ensureCollection(collectionName, dimensions);
  jobStore.addLog(jobId, "store", "Collection ready");

  // Upsert points in batches
  const batchSize = 100;
  let totalStored = 0;

  const docPath = buildDocPath(collectionName, fileName);

  const normalizedEntityTypes = normalizeEntityTypes(entityTypes);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const points = batch.map((chunk) => ({
      id: crypto.randomUUID(),
      vector: chunk.vector,
      payload: {
        text: chunk.text,
        fileName,
        docPath,
        chunkIndex: chunk.metadata.chunkIndex,
        startChar: chunk.metadata.startChar,
        endChar: chunk.metadata.endChar,
        entities: chunk.entities,
        entityTags: buildEntityTags(chunk.entities),
      },
    }));

    jobStore.addLog(jobId, "store", `Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);
    await upsertPoints(collectionName, points);
    totalStored += points.length;
  }

  jobStore.addLog(jobId, "store", `Successfully stored ${totalStored} vectors in collection "${collectionName}"`);
  jobStore.updateStage(jobId, "store", {
    output: {
      stored: totalStored,
      collection: collectionName,
      mode: "qdrant",
    },
  });

  // Register collection metadata
  if (embeddingConfig) {
    jobStore.registerCollection(
      collectionName,
      embeddingConfig.provider,
      embeddingConfig.model,
      dimensions,
      jobId,
      totalStored,
      systemPrompt,
      normalizedEntityTypes
    );
  }
}
