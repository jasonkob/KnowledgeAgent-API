"use client";

import { Check, X, Loader2, Circle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage, StageStatus } from "@/lib/pipeline/types";

interface StageNodeProps {
  stage: PipelineStage;
  isSelected: boolean;
  onClick: () => void;
  isLast: boolean;
}

function statusConfig(status: StageStatus) {
  switch (status) {
    case "running":
      return {
        icon: Loader2,
        ring: "ring-info/50",
        bg: "bg-info/20",
        iconColor: "text-info",
        label: "Running",
        labelColor: "text-info",
        animate: true,
        connectorColor: "bg-info",
      };
    case "success":
      return {
        icon: Check,
        ring: "ring-success/50",
        bg: "bg-success/20",
        iconColor: "text-success",
        label: "Done",
        labelColor: "text-success",
        animate: false,
        connectorColor: "bg-success",
      };
    case "error":
      return {
        icon: X,
        ring: "ring-destructive/50",
        bg: "bg-destructive/20",
        iconColor: "text-destructive",
        label: "Error",
        labelColor: "text-destructive",
        animate: false,
        connectorColor: "bg-destructive",
      };
    case "skipped":
      return {
        icon: SkipForward,
        ring: "ring-muted-foreground/20",
        bg: "bg-muted/50",
        iconColor: "text-muted-foreground",
        label: "Skipped",
        labelColor: "text-muted-foreground",
        animate: false,
        connectorColor: "bg-muted",
      };
    default:
      return {
        icon: Circle,
        ring: "ring-border",
        bg: "bg-secondary",
        iconColor: "text-muted-foreground",
        label: "Pending",
        labelColor: "text-muted-foreground",
        animate: false,
        connectorColor: "bg-border",
      };
  }
}

function getDuration(stage: PipelineStage): string | null {
  if (!stage.startedAt) return null;
  const end = stage.completedAt || Date.now();
  const ms = end - stage.startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function StageNode({ stage, isSelected, onClick, isLast }: StageNodeProps) {
  const config = statusConfig(stage.status);
  const Icon = config.icon;
  const duration = getDuration(stage);

  return (
    <div className="flex items-center">
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[100px]",
          "hover:bg-accent/50 cursor-pointer",
          isSelected && "bg-accent ring-1 ring-primary/30"
        )}
      >
        {/* Node circle */}
        <div
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full ring-2 transition-all",
            config.ring,
            config.bg
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              config.iconColor,
              config.animate && "animate-spin"
            )}
          />
          {stage.status === "running" && (
            <span className="absolute inset-0 rounded-full ring-2 ring-info/30 animate-ping" />
          )}
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-xs font-medium text-foreground leading-tight">
            {stage.label}
          </p>
          <p className={cn("text-[10px] font-mono mt-0.5", config.labelColor)}>
            {stage.status === "running"
              ? "Running..."
              : duration || config.label}
          </p>
        </div>
      </button>

      {/* Connector line */}
      {!isLast && (
        <div className="flex items-center px-1">
          <div
            className={cn(
              "h-0.5 w-8 rounded-full transition-colors",
              stage.status === "success" ? config.connectorColor : "bg-border"
            )}
          />
          <div
            className={cn(
              "h-0 w-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent transition-colors",
              stage.status === "success"
                ? "border-l-success"
                : "border-l-border"
            )}
          />
        </div>
      )}
    </div>
  );
}
