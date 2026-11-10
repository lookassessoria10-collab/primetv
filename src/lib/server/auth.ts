import "server-only";
import { env } from "./env";
import { HttpError } from "./http";
import { readCookie, SESSION_COOKIE, verifySessionToken, type Session } from "./session";

export async function getSession(request: Request): Promise<Session | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return verifySessionToken(token, env.sessionSecret);
}

/**
 * Bloqueia requisições de outras origens em operações de escrita (proteção CSRF),
 * além do cookie SameSite=Lax.
 */
export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) throw new HttpError(403, "Origem da requisição não identificada.", "forbidden");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Origem inválida.", "forbidden");
  }
  const allowed = new Set([host, url.host]);
  if (env.appUrl) {
    try {
      allowed.add(new URL(env.appUrl).host);
    } catch {
      /* APP_URL inválida é ignorada */
    }
  }
  if (!allowed.has(originHost)) throw new HttpError(403, "Origem não autorizada.", "forbidden");
}

/** Toda rota administrativa chama esta função, independentemente do proxy. */
export async function requireAdmin(request: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) throw new HttpError(401, "Sessão expirada. Entre novamente.", "unauthorized");
  assertSameOrigin(request);
  return session;
}

export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}
