"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { PipelineStage } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface StageDetailProps {
  stage: PipelineStage;
}

export function StageDetail({ stage }: StageDetailProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">{stage.label}</h4>
          <Badge
            variant={
              stage.status === "success"
                ? "default"
                : stage.status === "error"
                ? "destructive"
                : "secondary"
            }
            className={cn(
              "text-[10px] h-5",
              stage.status === "success" && "bg-success text-success-foreground",
              stage.status === "running" && "bg-info text-info-foreground"
            )}
          >
            {stage.status}
          </Badge>
        </div>
        {stage.startedAt && (
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(stage.startedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Logs */}
      <ScrollArea className="h-[200px]">
        <div className="p-3 space-y-1">
          {stage.logs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No logs yet...
            </p>
          ) : (
            stage.logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-xs font-mono">
                <span className="text-muted-foreground shrink-0 w-[75px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={cn(
                    log.level === "error" && "text-destructive",
                    log.level === "warn" && "text-warning",
                    log.level === "info" && "text-foreground"
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Output preview */}
      {stage.output && (
        <div className="border-t border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Output</p>
          <pre className="text-xs font-mono text-foreground bg-surface rounded p-2 overflow-auto max-h-[100px]">
            {JSON.stringify(stage.output, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {stage.error && (
        <div className="border-t border-border p-3 bg-destructive/5">
          <p className="text-xs font-medium text-destructive mb-1">Error</p>
          <p className="text-xs font-mono text-destructive/80">{stage.error}</p>
        </div>
      )}
    </div>
  );
}
