"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  MessageSquare,
  Pencil,
  Check,
  X,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ApiKeyItem {
  id: string;
  collectionName: string;
  systemPrompt: string;
  maskedKey: string;
  createdAt: number;
  lastUsed: number | null;
  requestCount: number;
  active: boolean;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [expandedUsage, setExpandedUsage] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchKeys();
    const interval = setInterval(fetchKeys, 5000);
    return () => clearInterval(interval);
  }, []);

  const revealKey = async (collectionName: string) => {
    if (revealedKeys[collectionName]) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[collectionName];
        return next;
      });
      return;
    }
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionName, action: "reveal" }),
      });
      const data = await res.json();
      if (data.key) {
        setRevealedKeys((prev) => ({ ...prev, [collectionName]: data.key }));
      }
    } catch {
      toast.error("Failed to reveal key");
    }
  };

  const regenerateKey = async (collectionName: string) => {
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionName, action: "regenerate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevealedKeys((prev) => ({ ...prev, [collectionName]: data.key }));
      toast.success("Key regenerated. Copy the new key now.");
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  };

  const savePrompt = async (collectionName: string) => {
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionName,
          action: "updatePrompt",
          systemPrompt: promptDraft,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("System prompt updated");
      setEditingPrompt(null);
      fetchKeys();
    } catch {
      toast.error("Failed to update prompt");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const activeKeys = keys.filter((k) => k.active);

  return (
    <div className="space-y-4">
      {activeKeys.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Key className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No API keys yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            API keys are auto-generated when you create a pipeline. Run your first pipeline to get started.
          </p>
        </div>
      ) : (
        activeKeys.map((k) => {
          const revealed = revealedKeys[k.collectionName];
          const isEditingThis = editingPrompt === k.collectionName;
          const isExpanded = expandedUsage === k.collectionName;

          return (
            <div
              key={k.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Key className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {k.collectionName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 gap-1 bg-secondary text-secondary-foreground"
                  >
                    <BarChart3 className="h-2.5 w-2.5" />
                    {k.requestCount} reqs
                  </Badge>
                  {k.lastUsed && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      Last used {new Date(k.lastUsed).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Key display */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                    API Key
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-foreground bg-surface rounded-md px-3 py-2 overflow-hidden border border-border">
                      {revealed || k.maskedKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revealKey(k.collectionName)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      title={revealed ? "Hide" : "Reveal"}
                    >
                      {revealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {revealed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(revealed)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateKey(k.collectionName)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      title="Regenerate"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      System Prompt
                    </p>
                    {!isEditingThis && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPrompt(k.collectionName);
                          setPromptDraft(k.systemPrompt);
                        }}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingThis ? (
                    <div className="space-y-2">
                      <Textarea
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        className="min-h-[80px] bg-surface border-border text-foreground font-mono text-xs resize-none"
                        placeholder="Enter system prompt for this collection's chat API..."
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPrompt(null)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => savePrompt(k.collectionName)}
                          className="h-7 px-3 text-xs gap-1 bg-primary text-primary-foreground"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-md bg-surface border border-border px-3 py-2 text-xs font-mono",
                        k.systemPrompt
                          ? "text-foreground"
                          : "text-muted-foreground/50 italic"
                      )}
                    >
                      {k.systemPrompt || "No system prompt set (default RAG prompt will be used)"}
                    </div>
                  )}
                </div>

                {/* Usage toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExpandedUsage(isExpanded ? null : k.collectionName)
                  }
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="h-3 w-3" />
                  {isExpanded ? "Hide" : "Show"} Usage Example
                </Button>

                {isExpanded && (
                  <div className="space-y-3 pt-1">
                    {/* Chat API */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Chat API (cURL)
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `curl -X POST \\\n  ${origin}/api/chat \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: ${revealed || "YOUR_API_KEY"}" \\\n  -d '{"message":"What is this document about?","collectionName":"${k.collectionName}"}'`
                            )
                          }
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Copy className="h-2.5 w-2.5" />
                          Copy
                        </Button>
                      </div>
                      <pre className="text-[11px] font-mono text-foreground bg-background rounded-md p-3 overflow-auto border border-border whitespace-pre-wrap leading-relaxed">
{`curl -X POST \\
  ${origin}/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${revealed || "YOUR_API_KEY"}" \\
  -d '{
    "message": "What is this document about?",
    "collectionName": "${k.collectionName}"
  }'`}
                      </pre>
                    </div>

                    {/* Python example */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Python
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `import requests\n\nres = requests.post(\n    "${origin}/api/chat",\n    headers={"x-api-key": "${revealed || "YOUR_API_KEY"}"},\n    json={\n        "message": "What is this document about?",\n        "collectionName": "${k.collectionName}"\n    }\n)\nprint(res.json()["answer"])`
                            )
                          }
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Copy className="h-2.5 w-2.5" />
                          Copy
                        </Button>
                      </div>
                      <pre className="text-[11px] font-mono text-foreground bg-background rounded-md p-3 overflow-auto border border-border whitespace-pre-wrap leading-relaxed">
{`import requests

res = requests.post(
    "${origin}/api/chat",
    headers={"x-api-key": "${revealed || "YOUR_API_KEY"}"},
    json={
        "message": "What is this document about?",
        "collectionName": "${k.collectionName}"
    }
)
print(res.json()["answer"])`}
                      </pre>
                    </div>

                    {/* JavaScript example */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          JavaScript
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `const res = await fetch("${origin}/api/chat", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": "${revealed || "YOUR_API_KEY"}"\n  },\n  body: JSON.stringify({\n    message: "What is this document about?",\n    collectionName: "${k.collectionName}"\n  })\n});\nconst { answer, sources } = await res.json();`
                            )
                          }
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Copy className="h-2.5 w-2.5" />
                          Copy
                        </Button>
                      </div>
                      <pre className="text-[11px] font-mono text-foreground bg-background rounded-md p-3 overflow-auto border border-border whitespace-pre-wrap leading-relaxed">
{`const res = await fetch("${origin}/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${revealed || "YOUR_API_KEY"}"
  },
  body: JSON.stringify({
    message: "What is this document about?",
    collectionName: "${k.collectionName}"
  })
});
const { answer, sources } = await res.json();`}
                      </pre>
                    </div>

                    {/* Response example */}
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Response
                      </p>
                      <pre className="text-[11px] font-mono text-muted-foreground bg-background rounded-md p-3 overflow-auto border border-border whitespace-pre-wrap leading-relaxed">
{`{
  "answer": "The document is about...",
  "sources": [
    {
      "index": 1,
      "score": 0.892,
      "text": "Relevant chunk...",
      "fileName": "document.pdf"
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
