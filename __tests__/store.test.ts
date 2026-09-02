import { describe, expect, it } from "vitest";
import { FAIL_URL, computeRun, type RunRecord } from "@/lib/server/store";

describe("computeRun", () => {
  it("reaches COMPLETED after the full timeline", () => {
    const record: RunRecord = {
      id: "r_complete",
      jobId: "j_complete",
      sourceUrl: "https://cdn.example.com/videos/sample.mp4",
      startedAt: 0,
    };

    const run = computeRun(record, 32_000);

    expect(run.stage).toBe("COMPLETED");
    expect(run.progressPct).toBe(100);
    expect(run.result).toMatchObject({
      durationSec: 142,
      warnings: ["Audio was normalized to stereo."],
    });
  });

  it("reaches FAILED for the corrupt source URL", () => {
    const record: RunRecord = {
      id: "r_failed",
      jobId: "j_failed",
      sourceUrl: FAIL_URL,
      startedAt: 0,
    };

    const run = computeRun(record, 16_000);

    expect(run.stage).toBe("FAILED");
    expect(run.progressPct).toBe(48);
    expect(run.error).toBe("The source media could not be decoded.");
  });

  it("keeps progress monotonic across stage boundaries", () => {
    const record: RunRecord = {
      id: "r_progress",
      jobId: "j_progress",
      sourceUrl: "https://cdn.example.com/videos/sample.mp4",
      startedAt: 0,
    };

    const samples = [0, 2_999, 3_000, 7_999, 8_000, 11_999, 12_000, 26_999, 27_000, 31_999]
      .map((elapsed) => computeRun(record, elapsed).progressPct);

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]);
    }
  });
});
