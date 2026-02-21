import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys-service";
import { jobStore } from "@/lib/pipeline/job-store";
import { runPipeline } from "@/lib/pipeline/runner";
import type { PipelineConfig } from "@/lib/pipeline/types";
import { randomUUID } from "crypto";
import { saveDocumentBuffer } from "@/lib/pipeline/document-store";

function randomCollectionName(): string {
  return `col_${randomUUID().replace(/-/g, "")}`;
}

export async function POST(req: NextRequest) {
  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required. Set x-api-key header." },
      { status: 401 }
    );
  }

  const validKey = await validateApiKey(apiKey);
  if (!validKey) {
    return NextResponse.json(
      { error: "Invalid or revoked API key" },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const configStr = formData.get("config") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    let config: PipelineConfig;
    try {
      config = JSON.parse(configStr || "{}");
    } catch {
      return NextResponse.json({ error: "Invalid config JSON" }, { status: 400 });
    }

    // Set defaults (locked to Ollama embeddings)
    config.embedding = config.embedding || { provider: "ollama", model: "bge-m3" };
    if (config.embedding.provider !== "ollama") {
      return NextResponse.json(
        { error: "Only Ollama embeddings are supported (provider must be 'ollama')" },
        { status: 400 }
      );
    }
    if (!config.embedding.model || config.embedding.model.trim().length === 0) {
      config.embedding.model = "bge-m3";
    }
    config.chunkingStrategy = config.chunkingStrategy || "fixed";
    config.chunkSize = config.chunkSize || 1000;
    config.chunkOverlap = config.chunkOverlap || 200;
    config.extractionPrompt = config.extractionPrompt || "";
    // Entity types (new)
    const legacyPrompt = (config.extractionPrompt || "").trim();
    config.entityTypes = Array.isArray((config as unknown as { entityTypes?: unknown }).entityTypes)
      ? ((config as unknown as { entityTypes: string[] }).entityTypes || []).filter(Boolean)
      : [];
    if (legacyPrompt && (!config.entityTypes || config.entityTypes.length === 0)) {
      config.entityTypes = [];
    }
    config.collectionName = (config.collectionName || "").trim() || randomCollectionName();
    config.systemPrompt = config.systemPrompt || "";

    const buffer = Buffer.from(await file.arrayBuffer());

    // Persist original for referencing
    try {
      saveDocumentBuffer(config.collectionName, file.name, buffer);
    } catch {
      // best-effort
    }

    const job = jobStore.createJob([{ name: file.name, type: file.type, size: file.size }], config);

    // Run pipeline asynchronously
    runPipeline(job.id, buffer, file.name, file.type, file.size, config).catch(
      () => {}
    );

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      collectionName: config.collectionName,
      streamUrl: `/api/pipelines/${job.id}/stream`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
