#!/usr/bin/env node
/**
 * Gera ADMIN_PASSWORD_HASH e um SESSION_SECRET aleatório.
 * Uso: npm run hash-password
 * (Alternativa sem terminal: abra /admin/setup no navegador.)
 */
import { webcrypto as crypto } from "node:crypto";
import readline from "node:readline";

const ITERATIONS = 600000;
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2_sha256:${ITERATIONS}:${b64url(salt)}:${b64url(bits)}`;
}

function ask(question, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write("*");
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

const password = process.argv[2] || (await ask("Nova senha do administrador: ", true));
if (!password || password.length < 12) {
  console.error("Use uma senha com pelo menos 12 caracteres.");
  process.exit(1);
}
console.log("\nADMIN_PASSWORD_HASH=" + (await hash(password)));
console.log("SESSION_SECRET=" + b64url(crypto.getRandomValues(new Uint8Array(32))));
console.log("\nCopie as linhas acima para as variáveis de ambiente (Vercel → Settings → Environment Variables).");
