import { jobStore } from "../job-store";
import { SUPPORTED_FILE_TYPES } from "../types";

export async function runUploadStage(
  jobId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ buffer: Buffer; fileName: string; fileType: string }> {
  jobStore.addLog(jobId, "upload", `Received file: ${fileName}`);
  jobStore.addLog(jobId, "upload", `File size: ${(fileSize / 1024).toFixed(1)} KB`);
  jobStore.addLog(jobId, "upload", `File type: ${fileType}`);

  // Validate file type
  const isSupported = SUPPORTED_FILE_TYPES.includes(fileType) ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".txt");

  if (!isSupported) {
    throw new Error(`Unsupported file type: ${fileType}. Supported: PDF, CSV, TXT`);
  }

  if (fileSize > 50 * 1024 * 1024) {
    throw new Error("File too large. Maximum 50MB allowed.");
  }

  jobStore.addLog(jobId, "upload", "File validation passed");
  jobStore.updateStage(jobId, "upload", {
    output: { fileName, fileType, fileSize },
  });

  return { buffer: fileBuffer, fileName, fileType };
}
