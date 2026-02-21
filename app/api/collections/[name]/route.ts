import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/pipeline/job-store";
import { isJobRepoEnabled, listJobs as listJobsFromRepo } from "@/lib/pipeline/job-repo";
import { getCollectionByName } from "@/lib/pipeline/collection-repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  let collection = jobStore.getCollection(name);
  if (!collection && isJobRepoEnabled()) {
    try {
      collection = await getCollectionByName(name);
    } catch {
      // ignore
    }
  }

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Get all jobs associated with this collection
  const jobs = (isJobRepoEnabled()
    ? await listJobsFromRepo(500)
    : jobStore.listJobs()
  ).filter((j) => j.config.collectionName === name);

  return NextResponse.json({
    collection,
    jobs: jobs.map((j) => ({
      id: j.id,
      fileName: j.fileName,
      status: j.status,
      createdAt: j.createdAt,
    })),
  });
}
