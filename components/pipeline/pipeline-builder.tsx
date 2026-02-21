"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play, Settings2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "./file-upload";
import {
  CHUNKING_STRATEGIES,
  type ChunkingStrategy,
  type PipelineConfig,
} from "@/lib/pipeline/types";

interface PipelineBuilderProps {
  onJobCreated: (jobId: string) => void;
}

export function PipelineBuilder({ onJobCreated }: PipelineBuilderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const embeddingProvider = "ollama" as const;
  const embeddingModel = "bge-m3";
  const [chunkingStrategy, setChunkingStrategy] = useState<ChunkingStrategy>("fixed");
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityTypes, setEntityTypes] = useState<string[]>(["ชื่อคณะ", "ชื่อสาขาวิชา", "ชื่อบุคคล"]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addEntityType = () => {
    const v = entityTypeInput.trim();
    if (!v) return;
    if (entityTypes.includes(v)) {
      setEntityTypeInput("");
      return;
    }
    setEntityTypes((prev) => [...prev, v]);
    setEntityTypeInput("");
  };

  // Auto-generate collection name from file
  const generateCollectionName = (fileName: string) => {
    const base = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const short = Math.random().toString(36).substring(2, 8);
    return `${base}_${short}`;
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    setIsSubmitting(true);

    try {
      const collectionName = generateCollectionName(files[0].name);
      const config: PipelineConfig = {
        embedding: { provider: embeddingProvider, model: embeddingModel },
        chunkingStrategy,
        chunkSize,
        chunkOverlap,
        entityTypes,
        collectionName,
        systemPrompt,
      };

      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }
      formData.append("config", JSON.stringify(config));

      const res = await fetch("/api/pipelines", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create pipeline");
      }

      toast.success(`Pipeline started with ${files.length} file${files.length > 1 ? "s" : ""}!`);
      onJobCreated(data.jobId);

      // Reset form
      setFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create pipeline");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: File Upload */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            Upload Documents
          </h3>
          <FileUpload files={files} onFilesChange={setFiles} />
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            Entity Types
          </h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={entityTypeInput}
                onChange={(e) => setEntityTypeInput(e.target.value)}
                placeholder="เพิ่มประเภท entity เช่น ชื่อรายวิชา"
                className="bg-surface border-border text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEntityType();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={addEntityType}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {entityTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">ไม่มี entity types (จะข้ามการ extract)</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {entityTypes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground">
                    <span className="font-mono">[{t}]</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEntityTypes((prev) => prev.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              ระบบจะสร้าง prompt เบื้องหลังให้อัตโนมัติ (ผู้ใช้ไม่เห็น)
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              3
            </span>
            Chat System Prompt
          </h3>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={"e.g., You are a helpful assistant that answers questions about company policies. Always respond in Thai. If the context doesn't contain the answer, say so clearly."}
            className="min-h-[100px] bg-surface border-border text-foreground placeholder:text-muted-foreground font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            System prompt for the chat API of this collection. An API key will be auto-generated.
          </p>
        </div>
      </div>

      {/* Right: Configuration */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Pipeline Configuration
          </h3>

          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1">
              <Label className="text-foreground text-xs">Embedding</Label>
              <div className="rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-xs text-muted-foreground font-mono">ollama / bge-m3</p>
              </div>
            </div>

            {/* Collection Info */}
            <div className="rounded-md border border-border/60 bg-primary/5 p-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All files will be stored in a single auto-created Qdrant collection.
                You can add more documents later via the{" "}
                <span className="text-primary font-medium">ingest API</span>.
              </p>
            </div>

            {/* Chunking Strategy */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Chunking Strategy</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHUNKING_STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setChunkingStrategy(s.value)}
                    className={`flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors ${
                      chunkingStrategy === s.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs font-medium">{s.label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{s.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chunk Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs">Chunk Size</Label>
                <span className="text-xs text-muted-foreground font-mono">{chunkSize}</span>
              </div>
              <Slider
                value={[chunkSize]}
                onValueChange={(v) => setChunkSize(v[0])}
                min={200}
                max={4000}
                step={100}
              />
            </div>

            {/* Chunk Overlap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs">Chunk Overlap</Label>
                <span className="text-xs text-muted-foreground font-mono">{chunkOverlap}</span>
              </div>
              <Slider
                value={[chunkOverlap]}
                onValueChange={(v) => setChunkOverlap(v[0])}
                min={0}
                max={1000}
                step={50}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={files.length === 0 || isSubmitting}
          className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          size="lg"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Starting Pipeline...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Run Pipeline
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
