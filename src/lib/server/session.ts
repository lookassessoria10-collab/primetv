import { fromBase64Url, toBase64Url } from "../password";

/**
 * Sessão administrativa assinada (HMAC-SHA256) em cookie HttpOnly.
 * Sem dependências de Node: usada tanto no proxy quanto nas rotas de API.
 */

export const SESSION_COOKIE = "prime_admin";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface Session {
  user: string;
  iat: number;
  exp: number;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(user: string, secret: string, ttl = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ u: user, iat: now, exp: now + ttl, v: 1 })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token || !secret || secret.length < 32) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(sig) as BufferSource,
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { u?: string; iat?: number; exp?: number };
    if (!data.u || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { user: data.u, iat: data.iat ?? 0, exp: data.exp };
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_TTL_SECONDS): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return sessionCookie("", secure, 0);
}
