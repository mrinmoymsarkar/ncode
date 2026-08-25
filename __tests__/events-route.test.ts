import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/runs/[id]/events/route";
import { authenticate, issueTokens } from "@/lib/server/auth";
import { createJob, startRun } from "@/lib/server/store";

describe("GET /api/runs/:id/events", () => {
  it("rejects requests without an access token", async () => {
    const response = await GET(new Request("http://localhost/api/runs/missing/events"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(401);
  });

  it("starts an authenticated stream with the current run snapshot", async () => {
    const user = authenticate("demo@encodr.dev", "password123");
    if (!user) throw new Error("Demo user should authenticate in the test fixture");
    const job = createJob({ sourceUrl: "https://cdn.example.com/videos/sample.mp4" });
    const run = startRun(job.id);
    if (!run) throw new Error("The test job should start a run");

    const { accessToken } = issueTokens(user.id);
    const response = await GET(
      new Request(`http://localhost/api/runs/${run.id}/events`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      { params: Promise.resolve({ id: run.id }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("The SSE response should have a body");
    const first = await reader.read();
    const eventText = new TextDecoder().decode(first.value);
    expect(eventText).toContain('"stage":"QUEUED"');
    expect(eventText).toContain('"progressPct":0');
    await reader.cancel();
  });
});
