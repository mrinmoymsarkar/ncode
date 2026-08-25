import { getJob } from "@/lib/server/store";
import { error, json, withAuth } from "@/lib/server/http";

// TODO(candidate): auth-guarded — return the job by id (404 if missing).
// Note: in Next 15+, `params` is a Promise — `const { id } = await params`.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const job = getJob(id);
    return job ? json(job) : error(404, "Job not found");
  });
}
