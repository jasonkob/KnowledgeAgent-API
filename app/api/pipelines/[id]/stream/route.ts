import { NextRequest } from "next/server";
import { jobStore } from "@/lib/pipeline/job-store";
import { getJobById, isJobRepoEnabled } from "@/lib/pipeline/job-repo";

export const dynamic = "force-dynamic";

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
      // ignore
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastSentHash = "";

      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      // Initial state or not-found
      if (!job) {
        send({ type: "error", error: "Job not found" });
      } else {
        send({ type: "job-update", job });
      }

      const interval = setInterval(() => {
        try {
          const tick = async () => {
            let fresh = jobStore.getJob(id, { refresh: true });

            if (!fresh && isJobRepoEnabled()) {
              try {
                const fromDb = await getJobById(id);
                if (fromDb) {
                  jobStore.importJob(fromDb);
                  fresh = fromDb;
                }
              } catch {
                // ignore
              }
            }

          if (!fresh) {
            send({ type: "error", error: "Job not found" });
            clearInterval(interval);
            controller.close();
            return;
          }

          const hash = `${fresh.status}:${fresh.completedAt ?? ""}:${fresh.error ?? ""}:${fresh.currentFileIndex ?? ""}:${fresh.stages
            .map((s) => `${s.name}:${s.status}:${s.logs.length}:${s.error ?? ""}`)
            .join("|")}`;
          if (hash !== lastSentHash) {
            lastSentHash = hash;
            send({ type: "job-update", job: fresh });
          }

          if (fresh.status === "completed" || fresh.status === "failed") {
            clearInterval(interval);
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }, 500);
          }
          };
          void tick().catch(() => {
            clearInterval(interval);
            try {
              controller.close();
            } catch {
              // already closed
            }
          });
        } catch {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }, 500);

      _req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
