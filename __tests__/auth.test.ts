import { describe, expect, it } from "vitest";

import {
  authenticate,
  getUserIdFromRequest,
  issueAccessToken,
  issueTokens,
} from "@/lib/server/auth";

describe("authentication", () => {
  it("issues a usable access token for the demo user", () => {
    const user = authenticate("demo@encodr.dev", "password123");
    if (!user) throw new Error("Demo user should authenticate in the test fixture");

    const { accessToken } = issueTokens(user.id);
    const request = new Request("http://localhost/api/jobs", {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(getUserIdFromRequest(request)).toBe(user.id);
  });

  it("rejects token issuance for unknown users", () => {
    expect(() => issueTokens("u_missing")).toThrow("unknown user");
    expect(() => issueAccessToken("u_missing")).toThrow("unknown user");
  });
});
