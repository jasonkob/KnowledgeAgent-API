export async function getOllamaEmbeddings(
  texts: string[],
  model: string = "bge-m3"
): Promise<number[][]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const vectors: number[][] = [];

  for (const text of texts) {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Embeddings API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.embeddings && data.embeddings.length > 0) {
      vectors.push(data.embeddings[0]);
    } else {
      throw new Error("No embedding returned from Ollama");
    }
  }

  return vectors;
}
