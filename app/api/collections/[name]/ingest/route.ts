import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys-service";
import { jobStore } from "@/lib/pipeline/job-store";
import { runPipeline } from "@/lib/pipeline/runner";
import type { PipelineConfig } from "@/lib/pipeline/types";
import { isJobRepoEnabled } from "@/lib/pipeline/job-repo";
import { getCollectionByName } from "@/lib/pipeline/collection-repo";
import { saveDocumentBuffer } from "@/lib/pipeline/document-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: collectionName } = await params;

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

  // Check if collection exists, and inherit config if it does
  let existingCollection = jobStore.getCollection(collectionName);
  if (!existingCollection && isJobRepoEnabled()) {
    try {
      existingCollection = await getCollectionByName(collectionName);
    } catch {
      // ignore
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const configStr = formData.get("config") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    let overrides: Partial<PipelineConfig> = {};
    if (configStr) {
      try {
        overrides = JSON.parse(configStr);
      } catch {
        return NextResponse.json({ error: "Invalid config JSON" }, { status: 400 });
      }
    }

    // Build config: inherit from existing collection or use defaults
    const overrideEntityTypes = Array.isArray((overrides as unknown as { entityTypes?: unknown }).entityTypes)
      ? ((overrides as unknown as { entityTypes: string[] }).entityTypes || []).filter(Boolean)
      : [];
    const inheritedEntityTypes = Array.isArray((existingCollection as unknown as { entityTypes?: unknown })?.entityTypes)
      ? (((existingCollection as unknown as { entityTypes?: string[] }).entityTypes || []) as string[]).filter(Boolean)
      : [];

    const config: PipelineConfig = {
      embedding: overrides.embedding || (existingCollection
        ? {
            provider: existingCollection.embeddingProvider as PipelineConfig["embedding"]["provider"],
            model: existingCollection.embeddingModel,
          }
        : { provider: "ollama", model: "bge-m3" }),
      chunkingStrategy: overrides.chunkingStrategy || "fixed",
      chunkSize: overrides.chunkSize || 1000,
      chunkOverlap: overrides.chunkOverlap || 200,
      entityTypes: overrideEntityTypes.length > 0 ? overrideEntityTypes : inheritedEntityTypes,
      extractionPrompt: (overrides as unknown as { extractionPrompt?: string }).extractionPrompt || "",
      collectionName,
      systemPrompt: overrides.systemPrompt || "",
    };

    if (config.embedding.provider !== "ollama") {
      return NextResponse.json(
        { error: "Only Ollama embeddings are supported" },
        { status: 400 }
      );
    }

    // Warn if embedding mismatch
    if (
      existingCollection &&
      (config.embedding.provider !== existingCollection.embeddingProvider ||
        config.embedding.model !== existingCollection.embeddingModel)
    ) {
      return NextResponse.json(
        {
          error: `Embedding mismatch: collection "${collectionName}" uses ${existingCollection.embeddingProvider}/${existingCollection.embeddingModel}, but you provided ${config.embedding.provider}/${config.embedding.model}. Vectors must use the same embedding model.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Persist original for referencing
    try {
      saveDocumentBuffer(collectionName, file.name, buffer);
    } catch {
      // best-effort
    }

    const job = jobStore.createJob([{ name: file.name, type: file.type, size: file.size }], config);

    // Run pipeline asynchronously
    runPipeline(job.id, buffer, file.name, file.type, file.size, config).catch(() => {});

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      collectionName,
      streamUrl: `/api/pipelines/${job.id}/stream`,
      inherited: existingCollection
        ? {
            embeddingProvider: existingCollection.embeddingProvider,
            embeddingModel: existingCollection.embeddingModel,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
