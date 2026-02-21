import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/pipeline/job-store";
import { runPipelineMulti } from "@/lib/pipeline/runner";
import type { PipelineConfig } from "@/lib/pipeline/types";
import { randomUUID } from "crypto";
import { isJobRepoEnabled, listJobs as listJobsFromRepo } from "@/lib/pipeline/job-repo";
import { saveDocumentBuffer } from "@/lib/pipeline/document-store";

function randomCollectionName(): string {
  return `col_${randomUUID().replace(/-/g, "")}`;
}

export async function GET() {
  let jobs = jobStore.listJobs();
  if (isJobRepoEnabled()) {
    try {
      jobs = await listJobsFromRepo(200);
    } catch {
      // fallback to in-memory list
    }
  }
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileEntries = formData.getAll("files") as File[];
    const configStr = formData.get("config") as string | null;

    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
    }

    if (!configStr) {
      return NextResponse.json({ error: "Config is required" }, { status: 400 });
    }

    let config: PipelineConfig;
    try {
      config = JSON.parse(configStr);
    } catch {
      return NextResponse.json({ error: "Invalid config JSON" }, { status: 400 });
    }

    // Validate required config fields
    if (!config.embedding?.provider || !config.embedding?.model) {
      return NextResponse.json({ error: "Embedding provider and model are required" }, { status: 400 });
    }

    if (config.embedding.provider !== "ollama") {
      return NextResponse.json({ error: "Only Ollama embeddings are supported" }, { status: 400 });
    }

    // Auto-generate collection name if missing
    config.collectionName = (config.collectionName || "").trim() || randomCollectionName();

    // Set defaults
    config.chunkingStrategy = config.chunkingStrategy || "fixed";
    config.chunkSize = config.chunkSize || 1000;
    config.chunkOverlap = config.chunkOverlap || 200;
    // Entity types (new)
    const legacyPrompt = (config.extractionPrompt || "").trim();
    config.entityTypes = Array.isArray((config as unknown as { entityTypes?: unknown }).entityTypes)
      ? ((config as unknown as { entityTypes: string[] }).entityTypes || []).filter(Boolean)
      : [];
    // If legacy prompt exists, keep it for compatibility
    if (legacyPrompt && (!config.entityTypes || config.entityTypes.length === 0)) {
      config.entityTypes = [];
      // keep extractionPrompt as-is
    }
    config.systemPrompt = config.systemPrompt || "";

    // Read all file buffers
    const fileDatas: { buffer: Buffer; name: string; type: string; size: number }[] = [];
    for (const file of fileEntries) {
      const buffer = Buffer.from(await file.arrayBuffer());
      fileDatas.push({ buffer, name: file.name, type: file.type, size: file.size });
    }

    // Persist originals for referencing
    for (const f of fileDatas) {
      try {
        saveDocumentBuffer(config.collectionName, f.name, f.buffer);
      } catch {
        // best-effort
      }
    }

    const fileInfos = fileDatas.map((f) => ({ name: f.name, type: f.type, size: f.size }));
    const job = jobStore.createJob(fileInfos, config);

    // Run pipeline asynchronously
    runPipelineMulti(job.id, fileDatas, config).catch(() => {
      // Error already handled in runner
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      fileCount: fileDatas.length,
      collectionName: config.collectionName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
