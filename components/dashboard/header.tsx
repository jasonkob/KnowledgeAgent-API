"use client";

import { Database, Key, PlayCircle, FileText, MessageSquare, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "pipeline", label: "New Pipeline", icon: PlayCircle },
  { id: "history", label: "History", icon: FileText },
  { id: "collections", label: "Collections", icon: Layers },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "docs", label: "API Docs", icon: Database },
];

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground tracking-tight text-lg">
              KnowledgeAgent API
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            System Online
          </div>
        </div>
      </div>
    </header>
  );
}
