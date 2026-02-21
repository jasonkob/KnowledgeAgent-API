import { jobStore } from "../job-store";
import type { ChunkingStrategy } from "../types";

export interface TextChunk {
  id: number;
  text: string;
  metadata: {
    startChar: number;
    endChar: number;
    chunkIndex: number;
  };
}

// ─── Recursive separators (paragraph -> newline -> sentence -> word) ───
const RECURSIVE_SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "];

function recursiveSplit(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[] = RECURSIVE_SEPARATORS
): string[] {
  if (text.length <= chunkSize) return [text];

  const sep = separators[0];
  const remaining = separators.slice(1);
  const parts = text.split(sep);

  const results: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;

    if (candidate.length > chunkSize && current) {
      results.push(current);
      // Overlap: keep the tail of the current chunk
      if (chunkOverlap > 0 && current.length > chunkOverlap) {
        current = current.slice(-chunkOverlap) + sep + part;
      } else {
        current = part;
      }
    } else {
      current = candidate;
    }
  }

  if (current) {
    results.push(current);
  }

  // If any chunk is still too large, recurse with the next separator
  if (remaining.length > 0) {
    const finalResults: string[] = [];
    for (const chunk of results) {
      if (chunk.length > chunkSize) {
        finalResults.push(...recursiveSplit(chunk, chunkSize, chunkOverlap, remaining));
      } else {
        finalResults.push(chunk);
      }
    }
    return finalResults;
  }

  return results;
}

function fixedSizeSplit(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      if (chunkOverlap > 0 && current.length > chunkOverlap) {
        current = current.slice(-chunkOverlap) + " " + sentence;
      } else {
        current = sentence;
      }
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

export async function runChunkStage(
  jobId: string,
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  strategy: ChunkingStrategy = "fixed"
): Promise<TextChunk[]> {
  jobStore.addLog(jobId, "chunk", `Strategy: ${strategy}, size: ${chunkSize}, overlap: ${chunkOverlap}`);
  jobStore.addLog(jobId, "chunk", `Input text length: ${text.length} characters`);

  const rawChunks =
    strategy === "recursive"
      ? recursiveSplit(text, chunkSize, chunkOverlap)
      : fixedSizeSplit(text, chunkSize, chunkOverlap);

  let charPos = 0;
  const chunks: TextChunk[] = rawChunks.map((t, i) => {
    const start = charPos;
    charPos += t.length;
    return {
      id: i,
      text: t,
      metadata: { startChar: start, endChar: charPos, chunkIndex: i },
    };
  });

  jobStore.addLog(jobId, "chunk", `Created ${chunks.length} chunks (${strategy})`);
  jobStore.updateStage(jobId, "chunk", {
    output: {
      chunkCount: chunks.length,
      strategy,
      avgChunkSize: Math.round(chunks.reduce((s, c) => s + c.text.length, 0) / (chunks.length || 1)),
    },
  });

  return chunks;
}
