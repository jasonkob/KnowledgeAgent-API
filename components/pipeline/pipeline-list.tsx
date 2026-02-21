"use client";

import { useEffect, useState } from "react";
import { Clock, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineJob } from "@/lib/pipeline/types";

interface PipelineListProps {
  onSelectJob: (jobId: string) => void;
  refreshTrigger: number;
}

export function PipelineList({ onSelectJob, refreshTrigger }: PipelineListProps) {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/pipelines");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No pipelines yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Create a new pipeline to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {jobs.length} pipeline{jobs.length !== 1 ? "s" : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={fetchJobs} className="text-muted-foreground hover:text-foreground h-7 text-xs">
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Refresh
        </Button>
      </div>

      {jobs.map((job) => {
        const completedStages = job.stages.filter(
          (s) => s.status === "success"
        ).length;
        const totalStages = job.stages.length;
        const elapsed = job.completedAt
          ? ((job.completedAt - job.createdAt) / 1000).toFixed(1)
          : ((Date.now() - job.createdAt) / 1000).toFixed(0);

        return (
          <button
            key={job.id}
            onClick={() => onSelectJob(job.id)}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground truncate">
                  {job.files && job.files.length > 1
                    ? `${job.files.length} files`
                    : job.fileName}
                </span>
                <Badge
                  className={cn(
                    "text-[10px] h-5 shrink-0",
                    job.status === "completed" && "bg-success text-success-foreground",
                    job.status === "running" && "bg-info text-info-foreground",
                    job.status === "failed" && "bg-destructive text-destructive-foreground",
                    job.status === "queued" && "bg-secondary text-secondary-foreground"
                  )}
                >
                  {job.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono">
                  {completedStages}/{totalStages} stages
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {elapsed}s
                </span>
                <span className="font-mono text-primary/80 truncate max-w-[160px]" title={job.config.collectionName}>
                  {job.config.collectionName}
                </span>
                <span>{new Date(job.createdAt).toLocaleString()}</span>
              </div>
              {/* Mini progress */}
              <div className="flex gap-1 mt-2">
                {job.stages.map((stage) => (
                  <div
                    key={stage.name}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      stage.status === "success" && "bg-success",
                      stage.status === "error" && "bg-destructive",
                      stage.status === "running" && "bg-info animate-pulse",
                      stage.status === "skipped" && "bg-muted",
                      stage.status === "idle" && "bg-border"
                    )}
                  />
                ))}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
