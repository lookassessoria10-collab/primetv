import { verifyPassword } from "@/lib/password";
import { isSecureRequest } from "@/lib/server/auth";
import { env, missingAuthConfig } from "@/lib/server/env";
import { HttpError, json, withErrors } from "@/lib/server/http";
import { createSessionToken, sessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Limitação simples de tentativas por IP (melhor esforço: memória da instância).
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const POST = withErrors(async (request: Request) => {
  const missing = missingAuthConfig();
  if (missing.length) {
    throw new HttpError(503, `Login desativado: configure ${missing.join(", ")}.`, "auth-not-configured", missing);
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== (request.headers.get("x-forwarded-host") || request.headers.get("host"))) {
    throw new HttpError(403, "Origem não autorizada.", "forbidden");
  }

  const ip = clientIp(request);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.count >= MAX_FAILURES && entry.until > now) {
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.", "rate-limited");
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Requisição inválida.");
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password || password.length > 256) throw new HttpError(400, "Informe usuário e senha.");

  const userOk = safeEqual(username.toLowerCase(), env.adminUser.toLowerCase());
  const passOk = await verifyPassword(password, env.adminPasswordHash);
  if (!userOk || !passOk) {
    const current = entry && entry.until > now ? entry : { count: 0, until: now + WINDOW_MS };
    current.count++;
    attempts.set(ip, current);
    await new Promise((r) => setTimeout(r, 400));
    throw new HttpError(401, "Usuário ou senha incorretos.", "invalid-credentials");
  }

  attempts.delete(ip);
  const token = await createSessionToken(env.adminUser, env.sessionSecret);
  return json({ ok: true, user: env.adminUser }, { headers: { "Set-Cookie": sessionCookie(token, isSecureRequest(request)) } });
});
