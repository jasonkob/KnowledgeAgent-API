import { NextResponse } from "next/server";
import { jobStore } from "@/lib/pipeline/job-store";
import { isJobRepoEnabled } from "@/lib/pipeline/job-repo";
import { listCollections as listCollectionsFromRepo } from "@/lib/pipeline/collection-repo";

export async function GET() {
  let collections = jobStore.listCollections();
  if (isJobRepoEnabled()) {
    try {
      collections = await listCollectionsFromRepo(500);
    } catch {
      // fallback
    }
  }
  return NextResponse.json({ collections });
}
