import { randomUUID } from "node:crypto";
import { ACTIVE_STAGES, type EncodeRun, type Job, type JobStatus } from "@/lib/types";

// In-memory store. A single Node process in `next dev`, so module-level Maps are fine.
//
// The job/run CRUD below is provided. The interesting part — turning an in-flight run into a
// live stage + progress over ~20–40s — is left for you.

const jobs = new Map<string, Job>();
const runs = new Map<string, RunRecord>();

interface RunRecord {
  id: string;
  jobId: string;
  sourceUrl: string;
  startedAt: number; // epoch ms
}

/** The "magic" source URL that should always fail partway, so reviewers can see error handling. */
export const FAIL_URL = "https://cdn.example.com/videos/corrupt.mp4";

/**
 * TODO(candidate): compute a run's current state.
 *
 * Given a run record and a clock, derive { stage, progressPct, error?, result? }. Suggested approach:
 * model it as a pure function of elapsed time = (now - startedAt). Walk QUEUED → DOWNLOADING →
 * PROBING → TRANSCODING → PACKAGING over ~30s, then COMPLETED. If sourceUrl === FAIL_URL, end in
 * FAILED partway through. Keeping it pure (taking `now`) makes it easy to unit-test.
 */
export function computeRun(record: RunRecord, now: number = Date.now()): EncodeRun {
  const elapsed = Math.max(0, now - record.startedAt);
  const failed = record.sourceUrl === FAIL_URL;
  const failedAt = 16_000;
  if (failed && elapsed >= failedAt) {
    return {
      id: record.id, jobId: record.jobId, stage: "FAILED", progressPct: 48,
      error: "The source media could not be decoded.",
    };
  }

  const stages = [
    { stage: ACTIVE_STAGES[0], start: 0, end: 3_000 },
    { stage: ACTIVE_STAGES[1], start: 3_000, end: 8_000 },
    { stage: ACTIVE_STAGES[2], start: 8_000, end: 12_000 },
    { stage: ACTIVE_STAGES[3], start: 12_000, end: 27_000 },
    { stage: ACTIVE_STAGES[4], start: 27_000, end: 32_000 },
  ] as const;
  if (elapsed >= 32_000) {
    return {
      id: record.id, jobId: record.jobId, stage: "COMPLETED", progressPct: 100,
      result: {
        durationSec: 142,
        renditions: [
          { label: "1080p", width: 1920, height: 1080, sizeMb: 184.2 },
          { label: "720p", width: 1280, height: 720, sizeMb: 96.4 },
          { label: "480p", width: 854, height: 480, sizeMb: 51.8 },
        ],
        warnings: ["Audio was normalized to stereo."],
      },
    };
  }
  const current = stages.find(({ start, end }) => elapsed >= start && elapsed < end) ?? stages[0];
  const progressPct = Math.round(((elapsed - current.start) / (current.end - current.start)) * 100);
  return { id: record.id, jobId: record.jobId, stage: current.stage, progressPct };
}

// --- job/run CRUD (provided) ---

export function listJobs(): Job[] {
  return [...jobs.values()].map(withCurrentStatus).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): Job | null {
  const job = jobs.get(id);
  return job ? withCurrentStatus(job) : null;
}

function withCurrentStatus(job: Job): Job {
  if (!job.latestRunId) return { ...job };
  const run = getRun(job.latestRunId);
  if (!run) return { ...job };
  const status: JobStatus = run.stage === "COMPLETED" ? "COMPLETED" : run.stage === "FAILED" ? "FAILED" : "RUNNING";
  return { ...job, status };
}

export function createJob(input: { sourceUrl: string; title?: string }): Job {
  const id = `j_${randomUUID().slice(0, 8)}`;
  const sourceUrl = input.sourceUrl.trim();
  const job: Job = {
    id,
    title: input.title?.trim() || deriveTitle(sourceUrl),
    sourceUrl,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

function deriveTitle(sourceUrl: string): string {
  try {
    const path = new URL(sourceUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Untitled encode";
  } catch {
    return "Untitled encode";
  }
}

export function startRun(jobId: string): RunRecord | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const record: RunRecord = {
    id: `r_${randomUUID().slice(0, 8)}`,
    jobId,
    sourceUrl: job.sourceUrl,
    startedAt: Date.now(),
  };
  runs.set(record.id, record);
  job.latestRunId = record.id;
  // TODO(candidate): you'll probably also want the job's status in listJobs()/getJob() to reflect
  // its latest run (RUNNING / COMPLETED / FAILED). Decide where that derivation lives.
  return record;
}

export function getRunRecord(id: string): RunRecord | null {
  return runs.get(id) ?? null;
}

export function getRun(id: string, now: number = Date.now()): EncodeRun | null {
  const record = runs.get(id);
  return record ? computeRun(record, now) : null;
}

export type { RunRecord };
