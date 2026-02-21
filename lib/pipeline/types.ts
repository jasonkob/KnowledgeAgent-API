export type StageStatus = "idle" | "running" | "success" | "error" | "skipped";

export type StageName =
  | "upload"
  | "ocr"
  | "chunk"
  | "extract"
  | "embed"
  | "store";

export interface StageLog {
  timestamp: number;
  message: string;
  level: "info" | "warn" | "error";
}

export interface PipelineStage {
  name: StageName;
  label: string;
  status: StageStatus;
  logs: StageLog[];
  startedAt: number | null;
  completedAt: number | null;
  output: Record<string, unknown> | null;
  error: string | null;
}

export type EmbeddingProvider = "ollama";
export type ChunkingStrategy = "fixed" | "recursive";
export type ChatLLMProvider = "openai";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
}

export interface ChatLLMConfig {
  provider: ChatLLMProvider;
  model: string;
}

export interface PipelineConfig {
  embedding: EmbeddingConfig;
  chunkingStrategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  /** Entity type labels to extract, e.g. ["ชื่อคณะ", "ชื่อสาขาวิชา", "ชื่อบุคคล"] */
  entityTypes: string[];
  /** @deprecated legacy free-form extraction prompt */
  extractionPrompt?: string;
  collectionName: string;
  systemPrompt: string;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export interface PipelineJob {
  id: string;
  status: JobStatus;
  /** @deprecated use files instead */
  fileName: string;
  fileType: string;
  fileSize: number;
  files: FileInfo[];
  config: PipelineConfig;
  stages: PipelineStage[];
  createdAt: number;
  completedAt: number | null;
  error: string | null;
  /** Tracks which file index is currently processing */
  currentFileIndex: number;
}

export interface SSEMessage {
  type: "stage-update" | "job-complete" | "job-error" | "log";
  jobId: string;
  data: Record<string, unknown>;
}

export const STAGE_DEFINITIONS: { name: StageName; label: string }[] = [
  { name: "upload", label: "Upload & Validate" },
  { name: "ocr", label: "OCR / Parse" },
  { name: "chunk", label: "Chunking" },
  { name: "extract", label: "Entity Extract" },
  { name: "embed", label: "Embedding" },
  { name: "store", label: "Vector Store" },
];

export const EMBEDDING_MODELS: Record<EmbeddingProvider, { value: string; label: string; dimensions: number }[]> = {
  ollama: [{ value: "bge-m3", label: "bge-m3", dimensions: 1024 }],
};

export const CHAT_LLM_MODELS: Record<ChatLLMProvider, { value: string; label: string }[]> = {
  openai: [{ value: "default", label: "OpenAI/gpt4.1-mini" }],
};

export const CHUNKING_STRATEGIES: { value: ChunkingStrategy; label: string; description: string }[] = [
  { value: "fixed", label: "Fixed Size", description: "Split text into fixed-size chunks with overlap" },
  { value: "recursive", label: "Recursive", description: "Recursively split by paragraphs, sentences, then words" },
];

export const SUPPORTED_FILE_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
];

export const FILE_EXTENSIONS = [".pdf", ".csv", ".txt"];
