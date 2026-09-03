import { createJobSchema } from "@/lib/schemas";
import { createJob, listJobs } from "@/lib/server/store";
import { error, json, withAuth } from "@/lib/server/http";

export async function GET(req: Request) {
  return withAuth(req, () => json(listJobs()));
}

export async function POST(req: Request) {
  return withAuth(req, async () => {
    let body: unknown;
    try { body = await req.json(); } catch { return error(400, "Invalid JSON body"); }
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        (fieldErrors[field] ??= []).push(issue.message);
      }
      return json({ detail: "Validation failed", fieldErrors }, 422);
    }
    return json(createJob(parsed.data), 201);
  });
}
