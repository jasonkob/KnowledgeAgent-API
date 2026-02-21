"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  auth: boolean;
  body?: string;
  response?: string;
  category: string;
}

const endpoints: EndpointDoc[] = [
  // ── Chat / Q&A API (External) ──
  {
    method: "POST",
    path: "/api/chat",
    category: "Chat",
    description:
      "The main external API endpoint for Q&A against your document collections. Requires x-api-key header. Embedding model and system prompt are inherited from the collection automatically -- no need to specify them.",
    auth: true,
    body: `{
  "message": "What is the main finding?",
  "collectionName": "report_a1b2c3"
}

Optional fields (rarely needed):
  "history": [{ "role": "user", "content": "..." }, ...]
  "topK": 5  (default: 5)`,
    response: `{
  "answe": "The main finding is...",
  "reference": [
    "http://localhost:3000/pipeline0/report_a1b2c3/document.pdf"
  ]
}

If no references are available, the API omits the field:
{
  "answe": "..."
}`,
  },
  // ── Pipeline Management ──
  {
    method: "GET",
    path: "/api/pipelines",
    category: "Pipeline",
    description: "List all pipeline jobs with their current status and configuration.",
    auth: false,
    response: `{
  "jobs": [
    {
      "id": "uuid",
      "status": "completed" | "running" | "failed" | "queued",
      "fileName": "document.pdf",
      "config": { ... },
      "stages": [ ... ],
      "createdAt": 1700000000000
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/pipelines/:id",
    category: "Pipeline",
    description: "Get detailed status of a specific pipeline job, including all stage statuses, logs, and outputs.",
    auth: false,
    response: `{
  "job": {
    "id": "uuid",
    "status": "completed",
    "stages": [
      {
        "name": "upload",
        "status": "success",
        "logs": [ ... ],
        "output": { ... }
      }
    ]
  }
}`,
  },
  {
    method: "GET",
    path: "/api/pipelines/:id/stream",
    category: "Pipeline",
    description:
      "Server-Sent Events (SSE) stream for real-time pipeline progress updates. Connect via EventSource.",
    auth: false,
    response: `SSE stream events:
data: { "type": "job-update", "job": PipelineJob }
data: { "type": "job-complete" }`,
  },
  // ── Collections ──
  {
    method: "GET",
    path: "/api/collections",
    category: "Collections",
    description: "List all collections with metadata, embedding config, document count, and vector count.",
    auth: false,
    response: `{
  "collections": [
    {
      "name": "report_a1b2c3",
      "embeddingProvider": "openai",
      "embeddingModel": "text-embedding-3-small",
      "documentCount": 3,
      "vectorCount": 142,
      "pipelineIds": ["uuid1", "uuid2"]
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/collections/:name",
    category: "Collections",
    description: "Get detailed info about a collection and its documents.",
    auth: false,
    response: `{
  "collection": { ... },
  "jobs": [ { "id": "uuid", "fileName": "doc.pdf", ... } ]
}`,
  },
  {
    method: "POST",
    path: "/api/collections/:name/ingest",
    category: "Collections",
    description:
      "Add more documents to an existing collection. Embedding settings are inherited automatically -- you cannot change the embedding model once the collection is created.",
    auth: true,
    body: `FormData:
  file: File (PDF, CSV, TXT, PNG, JPEG, WebP)
  config (optional): JSON string {
    "chunkingStrategy": "fixed" | "recursive",
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "entityTypes": ["ชื่อคณะ", "ชื่อสาขาวิชา", "ชื่อบุคคล"]
  }`,
    response: `{
  "jobId": "uuid",
  "status": "queued",
  "collectionName": "report_a1b2c3",
  "streamUrl": "/api/pipelines/{jobId}/stream"
}`,
  },
  // ── API Keys ──
  {
    method: "GET",
    path: "/api/keys",
    category: "Keys",
    description: "List all API keys. Keys are auto-generated per collection when a pipeline completes.",
    auth: false,
    response: `{
  "keys": [
    {
      "id": "uuid",
      "collectionName": "report_a1b2c3",
      "systemPrompt": "You are a helpful...",
      "maskedKey": "dp_abc...xyz",
      "requestCount": 42,
      "active": true
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/keys",
    category: "Keys",
    description: "Manage keys: reveal, regenerate, or update system prompt for a collection's key.",
    auth: false,
    body: `// Reveal key
{ "collectionName": "report_a1b2c3", "action": "reveal" }

// Regenerate key (revokes old)
{ "collectionName": "report_a1b2c3", "action": "regenerate" }

// Update system prompt
{
  "collectionName": "report_a1b2c3",
  "action": "updatePrompt",
  "systemPrompt": "New prompt..."
}`,
    response: `// reveal: { "key": "dp_abc123..." }
// regenerate: { "id": "...", "key": "dp_new...", "collectionName": "..." }
// updatePrompt: { "success": true }`,
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-success/20 text-success border-success/30",
  POST: "bg-info/20 text-info border-info/30",
  DELETE: "bg-destructive/20 text-destructive border-destructive/30",
};

const categoryColors: Record<string, string> = {
  Chat: "bg-warning/15 text-warning border-warning/30",
  Pipeline: "bg-primary/15 text-primary border-primary/30",
  Collections: "bg-success/15 text-success border-success/30",
  Keys: "bg-accent text-accent-foreground border-border",
};

export function ApiDocs() {
  const categories = Array.from(new Set(endpoints.map((e) => e.category)));

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-8 pr-4">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            API Reference
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The external API is a simple <strong className="text-foreground">chat/Q&A endpoint</strong> only.
            Create a pipeline in the dashboard to process your documents, then use the auto-generated API key
            to ask questions via <code className="text-xs font-mono bg-surface px-1.5 py-0.5 rounded">POST /api/chat</code>.
            Embedding model and system prompt are inherited from the collection.
          </p>
        </div>

        {/* How it works flow */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h4 className="text-sm font-medium text-foreground mb-3">How it works</h4>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-primary font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">1</span>
              Create Pipeline
            </div>
            <span className="text-muted-foreground hidden sm:block">{'>'}</span>
            <div className="flex items-center gap-2 rounded-md bg-success/10 border border-success/20 px-3 py-2 text-success font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground text-[10px] font-bold shrink-0">2</span>
              Collection + API Key auto-created
            </div>
            <span className="text-muted-foreground hidden sm:block">{'>'}</span>
            <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2 text-warning font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold shrink-0">3</span>
              Use Chat API with key
            </div>
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className={`text-[10px] h-5 ${categoryColors[cat] || ""}`}>
                {cat}
              </Badge>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-4">
              {endpoints
                .filter((ep) => ep.category === cat)
                .map((ep, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-3 p-4 border-b border-border">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 font-mono ${methodColors[ep.method] || ""}`}
                      >
                        {ep.method}
                      </Badge>
                      <code className="text-sm font-mono text-foreground">
                        {ep.path}
                      </code>
                      {ep.auth && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 bg-warning/20 text-warning border-warning/30"
                        >
                          x-api-key
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {ep.description}
                      </p>

                      {ep.body && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Request Body
                          </p>
                          <pre className="text-xs font-mono text-foreground bg-surface rounded p-3 overflow-auto whitespace-pre-wrap">
                            {ep.body}
                          </pre>
                        </div>
                      )}

                      {ep.response && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Response
                          </p>
                          <pre className="text-xs font-mono text-foreground bg-surface rounded p-3 overflow-auto whitespace-pre-wrap">
                            {ep.response}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
