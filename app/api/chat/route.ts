import { NextRequest, NextResponse } from "next/server";
import { runRagGraph } from "@/lib/chat/rag-graph";
import { buildPublicReferenceUrl } from "@/lib/pipeline/document-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      collectionName,
      history = [],
      topK = 5,
    } = body as {
      message: string;
      collectionName: string;
      history?: { role: "user" | "assistant"; content: string }[];
      topK?: number;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (!collectionName?.trim()) {
      return NextResponse.json(
        { error: "collectionName is required" },
        { status: 400 }
      );
    }

    const apiKeyHeader = req.headers.get("x-api-key");
    const out = await runRagGraph({
      message,
      collectionName,
      history,
      topK,
      apiKeyHeader,
    });

    const refs = Array.from(
      new Set(
        out.sources
          .map((s) => s.docPath)
          .filter((p): p is string => Boolean(p && p.trim().length > 0))
          .map((p) => buildPublicReferenceUrl(p))
      )
    );

    return NextResponse.json(
      refs.length > 0
        ? { answe: out.answer, reference: refs }
        : { answe: out.answer }
    );
  } catch (err) {
    const status = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status }
    );
  }
}
