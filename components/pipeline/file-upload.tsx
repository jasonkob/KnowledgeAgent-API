"use client";

import { useCallback, useState } from "react";
import { Upload, X, FileText, TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILE_EXTENSIONS } from "@/lib/pipeline/types";

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

function getFileIcon(name: string) {
  if (name.endsWith(".pdf")) return FileText;
  if (name.endsWith(".csv")) return TableIcon;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      // Deduplicate by name+size
      const existing = new Set(files.map((f) => `${f.name}__${f.size}`));
      const fresh = arr.filter((f) => !existing.has(`${f.name}__${f.size}`));
      if (fresh.length > 0) {
        onFilesChange([...files, ...fresh]);
      }
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-accent/30"
        )}
      >
        <input
          type="file"
          multiple
          accept={FILE_EXTENSIONS.join(",")}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files);
            }
            e.target.value = "";
          }}
          aria-label="Upload files"
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground mb-2">
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground mb-0.5">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, CSV, TXT -- multiple files supported
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </span>
            <span>{formatSize(totalSize)}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface divide-y divide-border max-h-[240px] overflow-y-auto">
            {files.map((file, i) => {
              const Icon = getFileIcon(file.name);
              return (
                <div
                  key={`${file.name}-${file.size}-${i}`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onFilesChange([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
