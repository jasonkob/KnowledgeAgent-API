import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/pipeline/job-store";
import { getJobById, isJobRepoEnabled } from "@/lib/pipeline/job-repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let job = jobStore.getJob(id, { refresh: true });

  if (!job && isJobRepoEnabled()) {
    try {
      job = await getJobById(id);
      if (job) jobStore.importJob(job);
    } catch {
      // fallback to not-found
    }
  }

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
