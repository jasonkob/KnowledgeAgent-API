import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function contentTypeFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  return "application/octet-stream";
}

function sanitizeSegment(segment: string): string {
  return segment
    .trim()
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "") || "file";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docPath: string[] }> }
) {
  const { docPath } = await params;

  const safeParts = (docPath || []).map(sanitizeSegment).filter(Boolean);
  if (safeParts.length < 2) {
    return new Response("Not found", { status: 404 });
  }

  const fsPath = path.join(process.cwd(), ".data", "documents", ...safeParts);

  try {
    const stat = fs.statSync(fsPath);
    if (!stat.isFile()) return new Response("Not found", { status: 404 });

    const data = fs.readFileSync(fsPath);
    return new Response(data, {
      headers: {
        "Content-Type": contentTypeFromFileName(fsPath),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
