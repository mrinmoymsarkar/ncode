import { getRun } from "@/lib/server/store";
import { error, json, withAuth } from "@/lib/server/http";

// TODO(candidate): auth-guarded — return the current EncodeRun by id (404 if missing).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const run = getRun(id);
    return run ? json(run) : error(404, "Run not found");
  });
}
