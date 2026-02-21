import type { PipelineJob } from "./types";
import { getMysqlPool, isMysqlConfigured } from "../mysql";
import type { RowDataPacket } from "mysql2/promise";

const TABLE = "pipeline_jobs";

export function isJobRepoEnabled(): boolean {
  return isMysqlConfigured();
}

export async function upsertJob(job: PipelineJob): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;

  const now = Date.now();
  const jobJson = JSON.stringify(job);

  await pool.execute(
    `INSERT INTO ${TABLE} (id, status, created_at_ms, updated_at_ms, job_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       updated_at_ms = VALUES(updated_at_ms),
       job_json = VALUES(job_json)`,
    [job.id, job.status, job.createdAt ?? now, now, jobJson]
  );
}

export async function getJobById(jobId: string): Promise<PipelineJob | undefined> {
  const pool = getMysqlPool();
  if (!pool) return undefined;

  const [rows] = await pool.query<(RowDataPacket & { id: string; job_json: string })[]>(
    `SELECT id, job_json FROM ${TABLE} WHERE id = ? LIMIT 1`,
    [jobId]
  );

  const row = rows[0];
  if (!row?.job_json) return undefined;

  try {
    return JSON.parse(row.job_json) as PipelineJob;
  } catch {
    return undefined;
  }
}

export async function listJobs(limit = 100): Promise<PipelineJob[]> {
  const pool = getMysqlPool();
  if (!pool) return [];

  const [rows] = await pool.query<(RowDataPacket & { job_json: string })[]>(
    `SELECT job_json FROM ${TABLE} ORDER BY created_at_ms DESC LIMIT ?`,
    [Math.max(1, Math.min(500, limit))]
  );

  const jobs: PipelineJob[] = [];
  for (const r of rows) {
    try {
      jobs.push(JSON.parse(r.job_json) as PipelineJob);
    } catch {
      // ignore bad rows
    }
  }
  return jobs;
}
