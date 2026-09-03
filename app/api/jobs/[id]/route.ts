import { getJob } from "@/lib/server/store";
import { error, json, withAuth } from "@/lib/server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const job = getJob(id);
    return job ? json(job) : error(404, "Job not found");
  });
}
