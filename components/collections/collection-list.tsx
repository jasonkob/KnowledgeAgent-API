"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Database,
  FileText,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { CollectionInfo } from "@/lib/pipeline/job-store";

interface CollectionListProps {
  onSelectJob: (jobId: string) => void;
}

export function CollectionList({ onSelectJob }: CollectionListProps) {
  const [collections, setCollections] = useState<
    (CollectionInfo & { jobs?: { id: string; fileName: string; status: string; createdAt: number }[] })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      setCollections(data.collections || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionDetail = async (name: string) => {
    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(name)}`);
      const data = await res.json();
      setCollections((prev) =>
        prev.map((c) =>
          c.name === name ? { ...c, jobs: data.jobs || [] } : c
        )
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCollections();
    const interval = setInterval(fetchCollections, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExpand = (name: string) => {
    if (expandedCol === name) {
      setExpandedCol(null);
    } else {
      setExpandedCol(name);
      fetchCollectionDetail(name);
    }
  };

  const copyIngestCmd = (name: string) => {
    const cmd = `curl -X POST \\
  ${typeof window !== "undefined" ? window.location.origin : ""}/api/collections/${name}/ingest \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "file=@document.pdf"`;
    navigator.clipboard.writeText(cmd);
    toast.success("Ingest command copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No collections yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Run a pipeline to auto-create a collection
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {collections.length} collection{collections.length !== 1 ? "s" : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchCollections}
          className="text-muted-foreground hover:text-foreground h-7 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Refresh
        </Button>
      </div>

      {collections.map((col) => (
        <div
          key={col.name}
          className="rounded-lg border border-border bg-card overflow-hidden"
        >
          {/* Collection Header */}
          <button
            onClick={() => handleExpand(col.name)}
            className="w-full flex items-center gap-4 p-3 sm:p-4 hover:bg-accent/30 transition-colors text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground font-mono truncate">
                  {col.name}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>{col.vectorCount} vectors</span>
                <span>{col.documentCount} document{col.documentCount !== 1 ? "s" : ""}</span>
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 border-border text-muted-foreground"
                >
                  {col.embeddingProvider}/{col.embeddingModel}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(col.lastUpdated).toLocaleString()}
                </span>
              </div>
            </div>
          </button>

          {/* Expanded detail */}
          {expandedCol === col.name && (
            <div className="border-t border-border bg-surface/50 p-3 sm:p-4 space-y-4">
              {/* Ingest command */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 text-primary" />
                    Add data via API
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyIngestCmd(col.name)}
                    className="text-muted-foreground hover:text-foreground h-6 text-[10px]"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <pre className="text-[11px] font-mono text-muted-foreground bg-background rounded-md p-3 overflow-x-auto whitespace-pre">
{`POST /api/collections/${col.name}/ingest
x-api-key: YOUR_API_KEY
Content-Type: multipart/form-data

file: <your-document>
config (optional): {
  "chunkingStrategy": "fixed",
  "chunkSize": 1000,
  "entityTypes": ["ชื่อคณะ", "ชื่อสาขาวิชา", "ชื่อบุคคล"]
}`}
                </pre>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Embedding settings are inherited from the collection ({col.embeddingProvider}/{col.embeddingModel}). 
                  Mismatched embeddings will be rejected.
                </p>
              </div>

              {/* Documents in this collection */}
              {col.jobs && col.jobs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-primary" />
                    Documents ({col.jobs.length})
                  </h4>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1.5">
                      {col.jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => onSelectJob(job.id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-background hover:bg-accent/30 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground truncate">
                              {job.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={`text-[9px] h-4 ${
                                job.status === "completed"
                                  ? "bg-success text-success-foreground"
                                  : job.status === "failed"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-info text-info-foreground"
                              }`}
                            >
                              {job.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
