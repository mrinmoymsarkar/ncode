import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/jobs/route";
import { authenticate, issueTokens } from "@/lib/server/auth";

describe("POST /api/jobs", () => {
  it("returns field-level validation errors for invalid input", async () => {
    const user = authenticate("demo@encodr.dev", "password123");
    if (!user) throw new Error("Demo user should authenticate in the test fixture");

    const { accessToken } = issueTokens(user.id);
    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: "not-a-url",
          title: "x".repeat(81),
        }),
      }),
    );

    expect(response.status).toBe(422);

    const body = (await response.json()) as {
      detail: string;
      fieldErrors: Record<string, string[]>;
    };

    expect(body.detail).toBe("Validation failed");
    expect(body.fieldErrors.sourceUrl).toContain("Enter a valid URL");
    expect(body.fieldErrors.title).toContain("Keep the title under 80 characters");
  });
});
