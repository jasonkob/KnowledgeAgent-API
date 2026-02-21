import { PDFDocument } from "pdf-lib";
import { jobStore } from "../job-store";

const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";

function getOcrBackendUrl(): string | null {
  const raw = process.env.OCR_BACKEND_URL;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

async function ocrViaBackend(fileBuffer: Buffer, fileName: string, fileType: string): Promise<string> {
  const baseUrl = getOcrBackendUrl();
  if (!baseUrl) throw new Error("OCR_BACKEND_URL is not configured");

  const form = new FormData();
  // Buffer is a Uint8Array; convert to satisfy BlobPart typing in TS.
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: fileType || "application/octet-stream" });
  form.append("file", blob, fileName || "upload");

  const url = `${baseUrl}/v1/ocr?model=typhoon-ocr&task_type=structure`;
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: form });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OCR backend fetch failed: ${msg} (url=${url})`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OCR backend error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.text || "";
}

function stripBackendSinglePageHeader(text: string): string {
  // Backend multi-page mode returns headings like "## Page 1" even for single-page PDFs.
  return (text || "")
    .replace(/^\s*##\s*Page\s*1\s*\n+/i, "")
    .trim();
}

async function ocrImageBase64(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) throw new Error("TYPHOON_API_KEY is not configured");

  const response = await fetch(TYPHOON_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "typhoon-ocr",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 16384,
      temperature: 0.0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Typhoon OCR API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function extractPdfPages(buffer: Buffer): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  const pages: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const pdfBytes = await singlePageDoc.save();
    pages.push(Buffer.from(pdfBytes));
  }

  return pages;
}

export async function runOcrStage(
  jobId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string
): Promise<string> {
  // Handle text/CSV files directly
  if (fileType === "text/plain" || fileType === "text/csv" || fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const text = fileBuffer.toString("utf-8");
    jobStore.addLog(jobId, "ocr", `Parsed text file directly (${text.length} characters)`);
    jobStore.updateStage(jobId, "ocr", {
      output: { method: "direct-text", charCount: text.length },
    });
    return text;
  }

  // Handle images directly
  if (fileType.startsWith("image/")) {
    const backendUrl = getOcrBackendUrl();
    jobStore.addLog(
      jobId,
      "ocr",
      backendUrl ? "Processing image with Typhoon OCR (FastAPI backend)..." : "Processing image with Typhoon OCR..."
    );

    const text = backendUrl
      ? await ocrViaBackend(fileBuffer, fileName, fileType)
      : await ocrImageBase64(fileBuffer.toString("base64"), fileType);

    jobStore.addLog(jobId, "ocr", `OCR completed: ${text.length} characters extracted`);
    jobStore.updateStage(jobId, "ocr", {
      output: { method: backendUrl ? "typhoon-ocr-backend" : "typhoon-ocr", charCount: text.length, pages: 1 },
    });
    return text;
  }

  // Handle PDF - extract pages and OCR each
  if (fileType === "application/pdf") {
    const backendUrl = getOcrBackendUrl();
    if (backendUrl) {
      jobStore.addLog(jobId, "ocr", "Extracting PDF pages for backend OCR...");
      let pages: Buffer[] = [];
      try {
        pages = await extractPdfPages(fileBuffer);
      } catch (err) {
        jobStore.addLog(jobId, "ocr", `Warning: failed to split PDF pages (${err instanceof Error ? err.message : "unknown"}). Falling back to single backend request...`, "warn");
        const text = await ocrViaBackend(fileBuffer, fileName, fileType);
        jobStore.addLog(jobId, "ocr", `OCR completed: ${text.length} characters extracted`);
        jobStore.updateStage(jobId, "ocr", {
          output: { method: "typhoon-ocr-backend", charCount: text.length },
        });
        return text;
      }

      jobStore.addLog(jobId, "ocr", `Found ${pages.length} page(s) in PDF`);

      const blocks: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        jobStore.addLog(jobId, "ocr", `Processing page ${i + 1}/${pages.length} with Typhoon OCR (backend)...`);
        const raw = await ocrViaBackend(pages[i], `${fileName || "document"}.page.${i + 1}.pdf`, "application/pdf");
        const pageText = stripBackendSinglePageHeader(raw);
        blocks.push(`## Page ${i + 1}\n\n${pageText}`.trim());
        jobStore.addLog(jobId, "ocr", `Page ${i + 1}: ${pageText.length} characters extracted`);
      }

      const fullText = blocks.join("\n\n---PAGE BREAK---\n\n");
      jobStore.addLog(jobId, "ocr", `Total OCR output: ${fullText.length} characters from ${pages.length} pages`);
      jobStore.updateStage(jobId, "ocr", {
        output: { method: "typhoon-ocr-backend", charCount: fullText.length, pages: pages.length },
      });
      return fullText;
    }

    jobStore.addLog(jobId, "ocr", "Extracting PDF pages...");
    const pages = await extractPdfPages(fileBuffer);
    jobStore.addLog(jobId, "ocr", `Found ${pages.length} page(s) in PDF`);

    const allTexts: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      jobStore.addLog(jobId, "ocr", `Processing page ${i + 1}/${pages.length} with Typhoon OCR...`);
      const base64 = pages[i].toString("base64");
      const text = await ocrImageBase64(base64, "application/pdf");
      allTexts.push(text);
      jobStore.addLog(jobId, "ocr", `Page ${i + 1}: ${text.length} characters extracted`);
    }

    const fullText = allTexts.join("\n\n---PAGE BREAK---\n\n");
    jobStore.addLog(jobId, "ocr", `Total OCR output: ${fullText.length} characters from ${pages.length} pages`);
    jobStore.updateStage(jobId, "ocr", {
      output: { method: "typhoon-ocr", charCount: fullText.length, pages: pages.length },
    });
    return fullText;
  }

  throw new Error(`Unsupported file type for OCR: ${fileType}`);
}
