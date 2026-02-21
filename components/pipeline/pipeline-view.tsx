"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageNode } from "./stage-node";
import { StageDetail } from "./stage-detail";
import type { PipelineJob, StageName } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineViewProps {
  jobId: string;
  onBack: () => void;
}

export function PipelineView({ jobId, onBack }: PipelineViewProps) {
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageName | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE stream
    const es = new EventSource(`/api/pipelines/${jobId}/stream`);
    eventSourceRef.current = es;
    setConnectionError(null);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "error") {
          setConnectionError(data.error || "Stream error");
          return;
        }
        if (data.type === "job-update" && data.job) {
          setJob(data.job);
          // Auto-select the currently running stage
          const runningStage = data.job.stages.find(
            (s: { status: string }) => s.status === "running"
          );
          if (runningStage) {
            setSelectedStage(runningStage.name);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnectionError("Disconnected from pipeline stream");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          {!connectionError ? (
            <>
              <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Connecting to pipeline...</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{connectionError}</p>
              <p className="text-xs text-muted-foreground/70 font-mono">Job id: {jobId}</p>
              <Button variant="outline" size="sm" onClick={onBack}>
                Back
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const selectedStageData = job.stages.find((s) => s.name === selectedStage);
  const duration = job.completedAt
    ? ((job.completedAt - job.createdAt) / 1000).toFixed(1)
    : ((Date.now() - job.createdAt) / 1000).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {job.files && job.files.length > 1
                ? `${job.files.length} files`
                : job.fileName}
            </span>
            {job.files && job.files.length > 1 && job.status === "running" && (
              <span className="text-xs text-muted-foreground font-mono">
                ({(job.currentFileIndex ?? 0) + 1}/{job.files.length})
              </span>
            )}
          </div>
          <Badge
            className={cn(
              "text-xs",
              job.status === "completed" && "bg-success text-success-foreground",
              job.status === "running" && "bg-info text-info-foreground",
              job.status === "failed" && "bg-destructive text-destructive-foreground",
              job.status === "queued" && "bg-secondary text-secondary-foreground"
            )}
          >
            {job.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono">{duration}s</span>
        </div>
      </div>

      {/* Pipeline Stages - Jenkins-like horizontal flow */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center overflow-x-auto pb-2">
          {job.stages.map((stage, i) => (
            <StageNode
              key={stage.name}
              stage={stage}
              isSelected={selectedStage === stage.name}
              onClick={() => setSelectedStage(stage.name)}
              isLast={i === job.stages.length - 1}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              job.status === "completed"
                ? "bg-success"
                : job.status === "failed"
                ? "bg-destructive"
                : "bg-info"
            )}
            style={{
              width: `${
                (job.stages.filter(
                  (s) => s.status === "success" || s.status === "error"
                ).length /
                  job.stages.length) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && <StageDetail stage={selectedStageData} />}

      {/* Job Error */}
      {job.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive mb-1">Pipeline Error</p>
          <p className="text-xs font-mono text-destructive/80">{job.error}</p>
        </div>
      )}

      {/* Files List */}
      {job.files && job.files.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Files ({job.files.length})
          </p>
          <div className="space-y-1">
            {job.files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className={cn(
                  "flex items-center justify-between text-xs rounded px-2 py-1.5",
                  job.status === "running" && i === (job.currentFileIndex ?? 0)
                    ? "bg-info/10 text-info"
                    : i < (job.currentFileIndex ?? 0)
                    ? "text-success"
                    : "text-muted-foreground"
                )}
              >
                <span className="font-mono truncate flex items-center gap-2">
                  {job.status === "running" && i === (job.currentFileIndex ?? 0) && (
                    <span className="h-2 w-2 rounded-full bg-info animate-pulse shrink-0" />
                  )}
                  {job.status !== "failed" && i < (job.currentFileIndex ?? 0) && (
                    <span className="h-2 w-2 rounded-full bg-success shrink-0" />
                  )}
                  {f.name}
                </span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Config Summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Configuration
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Embedding</span>
            <span className="text-foreground font-mono">
              {job.config.embedding.provider}/{job.config.embedding.model}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Collection</span>
            <span className="text-foreground font-mono">
              {job.config.collectionName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Chunk Size</span>
            <span className="text-foreground font-mono">
              {job.config.chunkSize}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Overlap</span>
            <span className="text-foreground font-mono">
              {job.config.chunkOverlap}
            </span>
          </div>
          {job.config.systemPrompt && (
            <div className="col-span-2 pt-1">
              <span className="text-muted-foreground">System Prompt</span>
              <p className="text-foreground font-mono text-[11px] mt-0.5 leading-relaxed line-clamp-3">
                {job.config.systemPrompt}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
