import { describe, expect, it } from "vitest";
import { ACTIVE_STAGES, isTerminalStage } from "@/lib/types";

describe("test harness", () => {
  it("runs", () => {
    expect(isTerminalStage("COMPLETED")).toBe(true);
    expect(isTerminalStage("QUEUED")).toBe(false);
    expect(ACTIVE_STAGES).toContain("TRANSCODING");
  });
});
