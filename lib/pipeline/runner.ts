import { jobStore } from "./job-store";
import type { PipelineConfig, StageName } from "./types";
import { runUploadStage } from "./stages/upload";
import { runOcrStage } from "./stages/ocr";
import { runChunkStage } from "./stages/chunk";
import { runExtractStage } from "./stages/extract";
import { runEmbedStage } from "./stages/embed";
import { runStoreStage } from "./stages/store";

interface FileData {
  buffer: Buffer;
  name: string;
  type: string;
  size: number;
}

async function executeStage<T>(
  jobId: string,
  stageName: StageName,
  fn: () => Promise<T>
): Promise<T> {
  jobStore.updateStage(jobId, stageName, {
    status: "running",
    startedAt: Date.now(),
  });

  try {
    const result = await fn();
    jobStore.updateStage(jobId, stageName, {
      status: "success",
      completedAt: Date.now(),
    });
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    jobStore.addLog(jobId, stageName, `Error: ${errorMsg}`, "error");
    jobStore.updateStage(jobId, stageName, {
      status: "error",
      completedAt: Date.now(),
      error: errorMsg,
    });
    throw err;
  }
}

/**
 * Reset stage statuses so they can be reused for the next file.
 * Keep logs accumulated across files for full history.
 */
function resetStagesForNextFile(jobId: string) {
  const job = jobStore.getJob(jobId);
  if (!job) return;
  for (const stage of job.stages) {
    // Only reset stages that completed successfully - errored ones stay
    if (stage.status === "success") {
      jobStore.updateStage(jobId, stage.name, {
        status: "idle",
        startedAt: null,
        completedAt: null,
        output: null,
        error: null,
      });
    }
  }
}

/**
 * Process a single file through the full pipeline.
 * Returns the number of vectors stored.
 */
async function processSingleFile(
  jobId: string,
  file: FileData,
  config: PipelineConfig,
  fileIndex: number,
  totalFiles: number
): Promise<number> {
  const prefix = totalFiles > 1 ? `[${fileIndex + 1}/${totalFiles}] ` : "";

  // Stage 1: Upload & Validate
  jobStore.addLog(jobId, "upload", `${prefix}Processing: ${file.name}`);
  const uploadResult = await executeStage(jobId, "upload", () =>
    runUploadStage(jobId, file.buffer, file.name, file.type, file.size)
  );

  // Stage 2: OCR / Parse
  jobStore.addLog(jobId, "ocr", `${prefix}Extracting text from: ${file.name}`);
  const text = await executeStage(jobId, "ocr", () =>
    runOcrStage(jobId, uploadResult.buffer, uploadResult.fileName, uploadResult.fileType)
  );

  // Stage 3: Chunking
  jobStore.addLog(jobId, "chunk", `${prefix}Chunking: ${file.name} (${config.chunkingStrategy})`);
  const chunks = await executeStage(jobId, "chunk", () =>
    runChunkStage(jobId, text, config.chunkSize, config.chunkOverlap, config.chunkingStrategy || "fixed")
  );

  // Stage 4: Entity Extraction
  jobStore.addLog(jobId, "extract", `${prefix}Extracting entities from: ${file.name}`);
  const extractedChunks = await executeStage(jobId, "extract", () =>
    runExtractStage(jobId, chunks, { entityTypes: config.entityTypes, extractionPrompt: config.extractionPrompt })
  );

  // Stage 5: Embedding
  jobStore.addLog(jobId, "embed", `${prefix}Embedding ${extractedChunks.length} chunks from: ${file.name}`);
  const embeddedChunks = await executeStage(jobId, "embed", () =>
    runEmbedStage(jobId, extractedChunks, config.embedding)
  );

  // Stage 6: Store in Vector DB
  jobStore.addLog(jobId, "store", `${prefix}Storing ${embeddedChunks.length} vectors from: ${file.name}`);
  await executeStage(jobId, "store", () =>
    runStoreStage(
      jobId,
      embeddedChunks,
      config.collectionName,
      file.name,
      config.embedding,
      config.systemPrompt,
      config.entityTypes
    )
  );

  return embeddedChunks.length;
}

/**
 * Run the pipeline for multiple files.
 * Each file goes through all 6 stages sequentially.
 * All vectors are stored in the same collection.
 */
export async function runPipelineMulti(
  jobId: string,
  files: FileData[],
  config: PipelineConfig
): Promise<void> {
  jobStore.updateJobStatus(jobId, "running");
  jobStore.addLog(jobId, "upload", `Starting pipeline with ${files.length} file(s)`);

  let totalVectors = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      jobStore.setCurrentFileIndex(jobId, i);

      // Reset stages for the new file (except first)
      if (i > 0) {
        resetStagesForNextFile(jobId);
      }

      const vectors = await processSingleFile(jobId, files[i], config, i, files.length);
      totalVectors += vectors;
    }

    jobStore.addLog(
      jobId,
      "store",
      `Pipeline complete: ${files.length} file(s), ${totalVectors} total vectors in "${config.collectionName}"`
    );
    jobStore.updateJobStatus(jobId, "completed");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    jobStore.updateJobStatus(jobId, "failed", errorMsg);

    // Mark remaining stages as skipped
    const job = jobStore.getJob(jobId);
    if (job) {
      for (const stage of job.stages) {
        if (stage.status === "idle") {
          jobStore.updateStage(jobId, stage.name, { status: "skipped" });
        }
      }
    }
  }
}

/**
 * Legacy: single file runner (used by ingest API).
 */
export async function runPipeline(
  jobId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  fileSize: number,
  config: PipelineConfig
): Promise<void> {
  return runPipelineMulti(
    jobId,
    [{ buffer: fileBuffer, name: fileName, type: fileType, size: fileSize }],
    config
  );
}
