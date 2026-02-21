import { jobStore } from "../job-store";
import type { TextChunk } from "./chunk";
import { buildEntityTags, extractEntitiesFromText } from "@/lib/entity-extraction";

export interface ExtractedChunk extends TextChunk {
  entities: Record<string, unknown> | null;
  extractionRaw: string;
}

export interface ExtractStageConfig {
  entityTypes?: string[];
  /** @deprecated legacy free-form extraction prompt */
  extractionPrompt?: string;
}

export async function runExtractStage(
  jobId: string,
  chunks: TextChunk[],
  config: ExtractStageConfig
): Promise<ExtractedChunk[]> {
  const entityTypes = Array.isArray(config?.entityTypes) ? config.entityTypes.filter(Boolean) : [];
  const legacyPrompt = (config?.extractionPrompt || "").trim();

  if (entityTypes.length === 0 && legacyPrompt.length === 0) {
    jobStore.addLog(jobId, "extract", "No entity types configured, skipping entity extraction");
    jobStore.updateStage(jobId, "extract", {
      output: { skipped: true, reason: "No entity types" },
    });
    return chunks.map((c) => ({ ...c, entities: null, extractionRaw: "" }));
  }

  jobStore.addLog(jobId, "extract", `Extracting entities from ${chunks.length} chunks`);
  if (entityTypes.length > 0) {
    jobStore.addLog(jobId, "extract", `Entity types: ${entityTypes.map((t) => `[${t}]`).join(" ")}`);
  } else {
    jobStore.addLog(jobId, "extract", "Using legacy extraction prompt (hidden)");
  }

  const results: ExtractedChunk[] = [];
  let extractedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    jobStore.addLog(jobId, "extract", `Processing chunk ${i + 1}/${chunks.length}...`);

    try {
      const { raw, parsed } = await extractEntitiesFromText({
        text: chunks[i].text,
        entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
        legacyInstructionPrompt: entityTypes.length === 0 ? legacyPrompt : undefined,
      });
      results.push({
        ...chunks[i],
        entities: parsed,
        extractionRaw: raw,
      });
      if (buildEntityTags(parsed).length > 0) extractedCount++;
    } catch (err) {
      jobStore.addLog(jobId, "extract", `Warning: extraction failed for chunk ${i + 1}: ${err instanceof Error ? err.message : "unknown error"}`, "warn");
      results.push({
        ...chunks[i],
        entities: null,
        extractionRaw: "",
      });
    }
  }

  jobStore.addLog(jobId, "extract", `Extraction complete: ${extractedCount}/${chunks.length} chunks had entities`);
  jobStore.updateStage(jobId, "extract", {
    output: { totalChunks: chunks.length, withEntities: extractedCount, entityTypeCount: entityTypes.length },
  });

  return results;
}
