/**
 * Hash de senha PBKDF2-SHA256 via WebCrypto (funciona no servidor e no navegador).
 * Formato: pbkdf2_sha256:<iterações>:<salt base64url>:<hash base64url>
 * Sem "$" para não sofrer expansão de variáveis em arquivos .env.
 */

export const PBKDF2_ITERATIONS = 600_000;
const PREFIX = "pbkdf2_sha256";

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) throw new Error("WebCrypto indisponível neste ambiente.");
  return c;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const c = getCrypto();
  const key = await c.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await c.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = getCrypto().getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}:${iterations}:${toBase64Url(salt)}:${toBase64Url(hash)}`;
}

export function isValidHashFormat(stored: string | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  return parts.length === 4 && parts[0] === PREFIX && Number(parts[1]) >= 100_000;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isValidHashFormat(stored)) return false;
  const [, iter, saltB64, hashB64] = stored.split(":");
  const expected = fromBase64Url(hashB64);
  const actual = await derive(password, fromBase64Url(saltB64), Number(iter));
  return constantTimeEqual(expected, actual);
}

export function randomSecret(bytes = 32): string {
  return toBase64Url(getCrypto().getRandomValues(new Uint8Array(bytes)));
}

export function passwordProblems(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 12) issues.push("use pelo menos 12 caracteres");
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) issues.push("combine letras e números");
  return issues;
}
