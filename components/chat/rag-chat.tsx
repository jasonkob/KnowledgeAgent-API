"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, FileSearch, Settings2, Loader2, BookOpen, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reference?: string[];
  sources?: { index: number; score: number; text: string; fileName?: string }[];
}

interface CollectionOption {
  name: string;
  embeddingProvider: string;
  embeddingModel: string;
  documentCount: number;
  vectorCount: number;
}

export function RagChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [expandedSources, setExpandedSources] = useState<number | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // Config state
  const [collectionName, setCollectionName] = useState("");
  const [topK, setTopK] = useState(5);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load collections
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await fetch("/api/collections");
        const data = await res.json();
        const cols: CollectionOption[] = (data.collections || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => ({
            name: c.name,
            embeddingProvider: c.embeddingProvider,
            embeddingModel: c.embeddingModel,
            documentCount: c.documentCount,
            vectorCount: c.vectorCount,
          })
        );
        setCollections(cols);
        // Auto-select first collection
        if (cols.length > 0 && !collectionName) {
          setCollectionName(cols[0].name);
        }
      } catch {
        // ignore
      } finally {
        setLoadingCollections(false);
      }
    };
    fetchCollections();
    const interval = setInterval(fetchCollections, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          collectionName,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          topK,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${data.error || "Something went wrong"}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answe,
            reference: Array.isArray(data.reference) ? data.reference : undefined,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Could not reach the server." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, collectionName, messages, topK]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 h-[calc(100vh-180px)]">
      {/* Chat Area */}
      <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">RAG Chat</span>
            <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
              OpenAI/gpt4.1-mini
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <FileSearch className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Ask your documents
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Chat with your processed documents using RAG. Make sure you have
                processed documents into a collection first.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "order-first" : ""}`}>
                    <div
                      className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Sources */}
                    {msg.reference && msg.reference.length > 0 && msg.role === "assistant" && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {msg.reference.map((href, idx) => (
                          <a
                            key={`${href}-${idx}`}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground underline underline-offset-4"
                            title={href}
                          >
                            <BookOpen className="h-3 w-3" />
                            Reference {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                      <User className="h-4 w-4 text-accent-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-surface px-3.5 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1 bg-surface border-border text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              size="icon"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Config Panel */}
      <div className={`${showConfig ? "block" : "hidden lg:block"} space-y-4`}>
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Chat Configuration
          </h3>

          {/* Collection */}
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              Collection
            </Label>
            {loadingCollections ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading collections...
              </div>
            ) : collections.length === 0 ? (
              <div className="rounded-md border border-border bg-surface p-3 text-center">
                <p className="text-xs text-muted-foreground">No collections yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Run a pipeline first to create one</p>
              </div>
            ) : (
              <Select
                value={collectionName}
                onValueChange={(v) => {
                  setCollectionName(v);
                }}
              >
                <SelectTrigger className="bg-surface border-border text-foreground text-sm">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{col.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {col.vectorCount}v / {col.documentCount}d
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Chat Model</Label>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-xs text-muted-foreground font-mono">OpenAI/gpt4.1-mini (OPENAI_BASE_URL / OPENAI_MODEL)</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Query Embedding</Label>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-xs text-muted-foreground font-mono">Ollama / bge-m3</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Must match the embedding used during pipeline</p>
          </div>

          {/* Top K */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="topK" className="text-xs text-foreground">Top K Results</Label>
              <span className="text-xs text-muted-foreground font-mono">{topK}</span>
            </div>
            <input
              id="topK"
              title="Top K Results"
              type="range"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* Quick Tips */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-xs font-medium text-foreground mb-2">Tips</h4>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
            <li>Embeddings are locked to Ollama for this app</li>
            <li>The collection name must match a processed pipeline</li>
            <li>Higher Top K provides more context but may add noise</li>
            <li>Sources are shown with relevance scores</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
