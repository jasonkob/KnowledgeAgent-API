import type { EmbeddingConfig } from "../pipeline/types";
import { getOllamaEmbeddings } from "./ollama";

export async function getEmbeddings(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  if (config.provider !== "ollama") {
    throw new Error("Only Ollama embeddings are supported");
  }
  return getOllamaEmbeddings(texts, config.model);
}
