import { describe, expect, it } from "vitest";

import { GET as getJobs } from "@/app/api/jobs/route";
import { POST as postJobs } from "@/app/api/jobs/route";
import { GET as getJob } from "@/app/api/jobs/[id]/route";
import { POST as postRuns } from "@/app/api/runs/route";
import { GET as getRun } from "@/app/api/runs/[id]/route";

describe("protected job and run routes", () => {
  it.each([
    ["GET /api/jobs", () => getJobs(new Request("http://localhost/api/jobs"))],
    [
      "POST /api/jobs",
      () => postJobs(new Request("http://localhost/api/jobs", { method: "POST", body: "{}" })),
    ],
    [
      "GET /api/jobs/:id",
      () => getJob(new Request("http://localhost/api/jobs/j_missing"), { params: Promise.resolve({ id: "j_missing" }) }),
    ],
    [
      "POST /api/runs",
      () => postRuns(new Request("http://localhost/api/runs", { method: "POST", body: "{}" })),
    ],
    [
      "GET /api/runs/:id",
      () => getRun(new Request("http://localhost/api/runs/r_missing"), { params: Promise.resolve({ id: "r_missing" }) }),
    ],
  ])("rejects unauthenticated requests to %s", async (_name, request) => {
    const response = await request();
    expect(response.status).toBe(401);
  });
});
