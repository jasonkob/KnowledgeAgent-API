import { NextRequest, NextResponse } from "next/server";
import {
  getKeyByCollection,
  listAllKeys,
  regenerateKey,
  revokeKey,
  updateSystemPrompt,
} from "@/lib/api-keys-service";

export async function GET() {
  const keys = await listAllKeys();
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { collectionName, action } = body;

    if (!collectionName) {
      return NextResponse.json({ error: "collectionName is required" }, { status: 400 });
    }

    // Regenerate key for a collection
    if (action === "regenerate") {
      const newKey = await regenerateKey(collectionName);
      if (!newKey) {
        return NextResponse.json({ error: "No key found for this collection" }, { status: 404 });
      }
      return NextResponse.json({
        id: newKey.id,
        key: newKey.key,
        collectionName: newKey.collectionName,
      });
    }

    // Update system prompt
    if (action === "updatePrompt") {
      const { systemPrompt } = body;
      const updated = await updateSystemPrompt(collectionName, systemPrompt || "");
      if (!updated) {
        return NextResponse.json({ error: "No key found for this collection" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    // Get full key for a collection
    if (action === "reveal") {
      const apiKey = await getKeyByCollection(collectionName);
      if (!apiKey) {
        return NextResponse.json({ error: "No key found" }, { status: 404 });
      }
      return NextResponse.json({ key: apiKey.key });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const revoked = await revokeKey(id);
    if (!revoked) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
