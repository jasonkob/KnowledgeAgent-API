"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/dashboard/header";
import { PipelineBuilder } from "@/components/pipeline/pipeline-builder";
import { PipelineList } from "@/components/pipeline/pipeline-list";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import { ApiDocs } from "@/components/settings/api-docs";
import { RagChat } from "@/components/chat/rag-chat";
import { CollectionList } from "@/components/collections/collection-list";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("pipeline");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleJobCreated = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab("history");
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSelectJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        if (tab !== "history") setSelectedJobId(null);
      }} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === "pipeline" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground text-balance">
                New Pipeline
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a document and configure the processing pipeline
              </p>
            </div>
            <PipelineBuilder onJobCreated={handleJobCreated} />
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {selectedJobId ? (
              <PipelineView jobId={selectedJobId} onBack={handleBackToList} />
            ) : (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground text-balance">
                    Pipeline History
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    View and monitor all pipeline executions
                  </p>
                </div>
                <PipelineList
                  onSelectJob={handleSelectJob}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "collections" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground text-balance">
                Collections
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Each pipeline creates a collection. Add more documents via the ingest API.
              </p>
            </div>
            <CollectionList
              onSelectJob={(jobId) => {
                setSelectedJobId(jobId);
                setActiveTab("history");
              }}
            />
          </div>
        )}

        {activeTab === "chat" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground text-balance">
                RAG Chat
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Chat with your processed documents using retrieval-augmented generation
              </p>
            </div>
            <RagChat />
          </div>
        )}

        {activeTab === "keys" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground text-balance">
                API Keys
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-generated API keys per collection for the chat Q&A endpoint
              </p>
            </div>
            <ApiKeyManager />
          </div>
        )}

        {activeTab === "docs" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground text-balance">
                API Documentation
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Reference documentation for integrating with the KnowledgeAgent API
              </p>
            </div>
            <ApiDocs />
          </div>
        )}
      </main>
    </div>
  );
}
