import { startRun, getJob } from "@/lib/server/store";
import { startRunSchema } from "@/lib/schemas";
import { error, json, withAuth } from "@/lib/server/http";

// TODO(candidate): auth-guarded — start an encode run for { jobId } and return { runId } (201).
export async function POST(req: Request) {
  return withAuth(req, async () => {
    let body: unknown;
    try { body = await req.json(); } catch { return error(400, "Invalid JSON body"); }
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) return error(422, "jobId is required");
    if (!getJob(parsed.data.jobId)) return error(404, "Job not found");
    const run = startRun(parsed.data.jobId);
    return run ? json({ runId: run.id }, 201) : error(404, "Job not found");
  });
}
