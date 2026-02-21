"use client";

import Link from "next/link";
import { Database, Key, PlayCircle, FileText, MessageSquare, Layers, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems: Array<
  { id: string; label: string; icon: React.ComponentType<{ className?: string }> } & (
    | { href?: undefined }
    | { href: string }
  )
> = [
  { id: "pipeline", label: "New Pipeline", icon: PlayCircle },
  { id: "history", label: "History", icon: FileText },
  { id: "collections", label: "Collections", icon: Layers },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "pricing", label: "Pricing", icon: Tag, href: "/pricing" },
  { id: "docs", label: "API Docs", icon: Database },
];

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 py-2 sm:h-14">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground tracking-tight text-lg">
              KnowledgeAgent API
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto max-w-full whitespace-nowrap">
          {navItems.map((item) => {
            const className = cn(
              "shrink-0 flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
              activeTab === item.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            );

            if ("href" in item && item.href) {
              return (
                <Link key={item.id} href={item.href} className={className}>
                  <item.icon className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={className}
              >
                <item.icon className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            System Online
          </div>
        </div>
      </div>
    </header>
  );
}
