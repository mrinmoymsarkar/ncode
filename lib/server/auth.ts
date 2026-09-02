import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@/lib/types";

const USERS: (User & { password: string })[] = [
  { id: "u_demo", email: "demo@encodr.dev", name: "Demo User", password: "password123" },
];

export function authenticate(email: string, password: string): User | null {
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

export function findUser(id: string): User | null {
  const user = USERS.find((u) => u.id === id);
  if (!user) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

const SECRET = process.env.ENCODR_AUTH_SECRET ?? "encodr-development-secret";
const ACCESS_TTL_SECONDS = 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24;

interface TokenPayload {
  type: "access" | "refresh";
  userId: string;
  exp: number;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: TokenPayload): string {
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token: string, expectedType: TokenPayload["type"]): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (payload.type !== expectedType || !payload.userId || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return findUser(payload.userId) ? payload.userId : null;
  } catch {
    return null;
  }
}

function issue(userId: string, type: TokenPayload["type"], ttl: number): string {
  return sign({ type, userId, exp: Math.floor(Date.now() / 1000) + ttl });
}

export function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  if (!findUser(userId)) {
    throw new Error("Cannot issue tokens for unknown user");
  }

  return {
    accessToken: issue(userId, "access", ACCESS_TTL_SECONDS),
    refreshToken: issue(userId, "refresh", REFRESH_TTL_SECONDS),
  };
}

export function issueAccessToken(userId: string): string {
  if (!findUser(userId)) {
    throw new Error("Cannot issue an access token for unknown user");
  }

  return issue(userId, "access", ACCESS_TTL_SECONDS);
}

/** Return the authenticated userId from the request, or null. */
export function getUserIdFromRequest(req: Request): string | null {
  const value = req.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return verify(value.slice(7), "access");
}

/** Verify a refresh token and return its subject (userId), or null. */
export function verifyRefreshToken(token: string): string | null {
  return verify(token, "refresh");
}
