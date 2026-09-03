import { describe, expect, it } from "vitest";

import { POST as startRunRoute } from "@/app/api/runs/route";
import { GET as getRunRoute } from "@/app/api/runs/[id]/route";
import { authenticate, issueTokens } from "@/lib/server/auth";
import { createJob } from "@/lib/server/store";

function authHeaders() {
  const user = authenticate("demo@encodr.dev", "password123");
  if (!user) throw new Error("Demo user should authenticate in the test fixture");
  return { authorization: `Bearer ${issueTokens(user.id).accessToken}` };
}

describe("run routes", () => {
  it("starts a run for an existing job", async () => {
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/sample.mp4" });
    const response = await startRunRoute(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.runId).toEqual(expect.stringMatching(/^r_/));
  });

  it("returns 404 when starting a run for a missing job", async () => {
    const response = await startRunRoute(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ jobId: "j_missing" }),
    }));

    expect(response.status).toBe(404);
  });

  it("returns the current run snapshot", async () => {
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/sample.mp4" });
    const startResponse = await startRunRoute(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }));
    const { runId } = (await startResponse.json()) as { runId: string };
    const response = await getRunRoute(
      new Request(`http://localhost/api/runs/${runId}`, { headers: authHeaders() }),
      { params: Promise.resolve({ id: runId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: runId, jobId: job.id, stage: "QUEUED", progressPct: 0 });
  });
});
