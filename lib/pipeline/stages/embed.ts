import { jobStore } from "../job-store";
import type { EmbeddingConfig } from "../types";
import type { ExtractedChunk } from "./extract";
import { getEmbeddings } from "../../embeddings";

export interface EmbeddedChunk extends ExtractedChunk {
  vector: number[];
}

export async function runEmbedStage(
  jobId: string,
  chunks: ExtractedChunk[],
  embeddingConfig: EmbeddingConfig
): Promise<EmbeddedChunk[]> {
  jobStore.addLog(jobId, "embed", `Embedding ${chunks.length} chunks with ${embeddingConfig.provider}/${embeddingConfig.model}`);

  const texts = chunks.map((c) => c.text);
  const batchSize = 20;
  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    jobStore.addLog(jobId, "embed", `Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);

    const vectors = await getEmbeddings(batch, embeddingConfig);
    allVectors.push(...vectors);
  }

  const results: EmbeddedChunk[] = chunks.map((chunk, i) => ({
    ...chunk,
    vector: allVectors[i],
  }));

  const dimensions = allVectors[0]?.length || 0;
  jobStore.addLog(jobId, "embed", `Embedding complete: ${allVectors.length} vectors of ${dimensions} dimensions`);
  jobStore.updateStage(jobId, "embed", {
    output: {
      vectorCount: allVectors.length,
      dimensions,
      provider: embeddingConfig.provider,
      model: embeddingConfig.model,
    },
  });

  return results;
}
