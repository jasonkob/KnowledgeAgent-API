export async function getGoogleEmbeddings(
  texts: string[],
  model: string = "text-embedding-004"
): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  // Google AI supports batch embedding
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
        })),
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google AI Embeddings API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: { values: number[] }) => e.values);
}
