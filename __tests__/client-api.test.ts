import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, AUTH_LOGOUT_EVENT } from "@/lib/client/api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/client/token-store";

describe("client API authentication", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes once and retries a request after a 401", async () => {
    setTokens({ accessToken: "expired-access", refreshToken: "valid-refresh" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Not authenticated" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "fresh-access" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "j_1" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get<unknown[]>("/api/jobs")).resolves.toEqual([{ id: "j_1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { authorization: "Bearer expired-access" },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: { authorization: "Bearer fresh-access" },
    });
    expect(getAccessToken()).toBe("fresh-access");
  });

  it("clears auth and dispatches logout when refresh fails", async () => {
    setTokens({ accessToken: "expired-access", refreshToken: "invalid-refresh" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const logout = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logout);

    await expect(api.get("/api/jobs")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_LOGOUT_EVENT, logout);
  });
});
