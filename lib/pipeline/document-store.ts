import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), ".data", "documents");

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .trim()
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\.+/g, (m) => m) // keep dots but will be normalized below
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  // prevent empty/hidden segments
  const safe = cleaned.replace(/^\.+/, "");
  return safe.length > 0 ? safe : "file";
}

export function buildDocPath(collectionName: string, fileName: string): string {
  const safeCollection = sanitizeSegment(collectionName);
  const safeFile = sanitizeSegment(fileName);
  return `${safeCollection}/${safeFile}`;
}

export function getFsPathForDocPath(docPath: string): string {
  // docPath is expected to be "collection/file"
  const parts = docPath.split("/").filter(Boolean).map(sanitizeSegment);
  const normalized = parts.join(path.sep);
  return path.join(DOCS_DIR, normalized);
}

export function saveDocumentBuffer(collectionName: string, fileName: string, buffer: Buffer): { docPath: string; fsPath: string } {
  const docPath = buildDocPath(collectionName, fileName);
  const fsPath = getFsPathForDocPath(docPath);
  ensureDir(path.dirname(fsPath));
  fs.writeFileSync(fsPath, buffer);
  return { docPath, fsPath };
}

export function buildPublicReferenceUrl(docPath: string): string {
  const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const encoded = docPath
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `${base}/pipeline0/${encoded}`;
}
