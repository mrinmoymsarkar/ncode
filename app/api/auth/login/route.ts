import { authenticate, issueTokens } from "@/lib/server/auth";
import { error, json } from "@/lib/server/http";
import { loginSchema } from "@/lib/schemas";

// TODO(candidate): validate { email, password } (loginSchema), authenticate against the mock user,
// and return { accessToken, refreshToken, user } on success (401 otherwise).
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return error(400, "Invalid JSON body"); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return error(422, "Validation failed");
  const user = authenticate(parsed.data.email, parsed.data.password);
  if (!user) return error(401, "Invalid email or password");
  return json({ ...issueTokens(user.id), user }, 200);
}
