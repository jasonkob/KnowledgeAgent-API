import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
  type PipelineJob,
  type PipelineStage,
  type PipelineConfig,
  type StageName,
  type StageLog,
  STAGE_DEFINITIONS,
} from "./types";
import { upsertJob } from "./job-repo";
import { upsertCollection } from "./collection-repo";
import { ensureKeyForCollection } from "../api-keys-service";

const DATA_DIR = path.join(process.cwd(), ".data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");

function ensureDataDirs() {
  try {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function jobPath(jobId: string) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function safeWriteJsonSync(filePath: string, value: unknown) {
  ensureDataDirs();
  const tmp = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, filePath);
  } catch {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

function safeReadJsonSync<T>(filePath: string): T | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export interface CollectionInfo {
  name: string;
  embeddingProvider: string;
  embeddingModel: string;
  dimensions: number;
  documentCount: number;
  vectorCount: number;
  createdAt: number;
  lastUpdated: number;
  pipelineIds: string[];
  entityTypes?: string[];
}

type Listener = (jobId: string, job: PipelineJob) => void;

class JobStore {
  private jobs: Map<string, PipelineJob> = new Map();
  private collections: Map<string, CollectionInfo> = new Map();
  private listeners: Set<Listener> = new Set();

  importJob(job: PipelineJob) {
    this.jobs.set(job.id, job);
    this.notify(job.id);
  }

  createJob(
    files: { name: string; type: string; size: number }[],
    config: PipelineConfig
  ): PipelineJob {
    const id = uuidv4();
    const stages: PipelineStage[] = STAGE_DEFINITIONS.map((def) => ({
      name: def.name,
      label: def.label,
      status: "idle",
      logs: [],
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
    }));

    const first = files[0] || { name: "unknown", type: "unknown", size: 0 };

    const job: PipelineJob = {
      id,
      status: "queued",
      fileName: first.name,
      fileType: first.type,
      fileSize: files.reduce((s, f) => s + f.size, 0),
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      config,
      stages,
      createdAt: Date.now(),
      completedAt: null,
      error: null,
      currentFileIndex: 0,
    };

    this.jobs.set(id, job);
    this.notify(id);
    return job;
  }

  setCurrentFileIndex(jobId: string, index: number) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.currentFileIndex = index;
    this.notify(jobId);
  }

  getJob(id: string, options?: { refresh?: boolean }): PipelineJob | undefined {
    if (!options?.refresh) {
      return this.jobs.get(id);
    }

    const fromDisk = safeReadJsonSync<PipelineJob>(jobPath(id));
    if (fromDisk) {
      this.jobs.set(id, fromDisk);
    }
    return fromDisk;
  }

  listJobs(): PipelineJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  updateJobStatus(
    jobId: string,
    status: PipelineJob["status"],
    error?: string
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = status;
    if (error) job.error = error;
    if (status === "completed" || status === "failed") {
      job.completedAt = Date.now();
    }
    this.notify(jobId);
  }

  updateStage(
    jobId: string,
    stageName: StageName,
    update: Partial<PipelineStage>
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const stage = job.stages.find((s) => s.name === stageName);
    if (!stage) return;
    Object.assign(stage, update);
    this.notify(jobId);
  }

  addLog(jobId: string, stageName: StageName, message: string, level: StageLog["level"] = "info") {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const stage = job.stages.find((s) => s.name === stageName);
    if (!stage) return;
    stage.logs.push({ timestamp: Date.now(), message, level });
    this.notify(jobId);
  }

  // ── Collection tracking ──

  registerCollection(
    name: string,
    embeddingProvider: string,
    embeddingModel: string,
    dimensions: number,
    pipelineId: string,
    vectorCount: number,
    systemPrompt?: string,
    entityTypes?: string[]
  ) {
    const existing = this.collections.get(name);
    if (existing) {
      existing.documentCount += 1;
      existing.vectorCount += vectorCount;
      existing.lastUpdated = Date.now();
      if (Array.isArray(entityTypes) && entityTypes.length > 0) {
        existing.entityTypes = entityTypes;
      }
      if (!existing.pipelineIds.includes(pipelineId)) {
        existing.pipelineIds.push(pipelineId);
      }
    } else {
      this.collections.set(name, {
        name,
        embeddingProvider,
        embeddingModel,
        dimensions,
        documentCount: 1,
        vectorCount,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        pipelineIds: [pipelineId],
        entityTypes: Array.isArray(entityTypes) && entityTypes.length > 0 ? entityTypes : undefined,
      });
      // Auto-generate an API key for this new collection
      void ensureKeyForCollection(name, systemPrompt || "");
    }

    const info = this.collections.get(name);
    if (info) {
      void upsertCollection(info).catch(() => {
        // ignore
      });
    }
  }

  getCollection(name: string): CollectionInfo | undefined {
    return this.collections.get(name);
  }

  listCollections(): CollectionInfo[] {
    return Array.from(this.collections.values()).sort(
      (a, b) => b.lastUpdated - a.lastUpdated
    );
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Best-effort snapshot persistence so other route workers can read job state.
    safeWriteJsonSync(jobPath(jobId), job);

    // Best-effort MySQL persistence (if configured).
    void upsertJob(job).catch(() => {
      // ignore persistence errors
    });

    for (const listener of this.listeners) {
      try {
        listener(jobId, { ...job, stages: job.stages.map((s) => ({ ...s })) });
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const jobStore = new JobStore();
