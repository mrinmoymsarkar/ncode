import { describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { authenticate, issueTokens } from "@/lib/server/auth";

describe("authentication routes", () => {
  it("logs in the demo user and returns both tokens", async () => {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@encodr.dev", password: "password123" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe("demo@encodr.dev");
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
  });

  it("rejects invalid credentials", async () => {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@encodr.dev", password: "wrong" }),
    }));

    expect(response.status).toBe(401);
  });

  it("rejects malformed login input", async () => {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    }));

    expect(response.status).toBe(422);
  });

  it("exchanges a valid refresh token", async () => {
    const user = authenticate("demo@encodr.dev", "password123");
    if (!user) throw new Error("Demo user should authenticate in the test fixture");
    const { refreshToken } = issueTokens(user.id);
    const response = await refresh(new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accessToken).toEqual(expect.any(String));
  });

  it("rejects an invalid refresh token", async () => {
    const response = await refresh(new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "invalid" }),
    }));

    expect(response.status).toBe(401);
  });
});
