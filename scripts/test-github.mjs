#!/usr/bin/env node
/**
 * Testa o armazenamento no GitHub de ponta a ponta contra o simulador local da API.
 * Requer um build de produção atualizado (npm run build).
 *
 *   ADMIN_USER=admin ADMIN_PASSWORD=... npm run test:github
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMockGitHub } from "./mock-github.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASS = process.env.ADMIN_PASSWORD;
const USER = process.env.ADMIN_USER || "admin";
if (!PASS) {
  console.error("Defina ADMIN_PASSWORD.");
  process.exit(1);
}
const MOCK_PORT = 4010;
const APP_PORT = 3211;
const BASE = `http://localhost:${APP_PORT}`;

const mock = createMockGitHub({ root });
await new Promise((r) => mock.server.listen(MOCK_PORT, r));

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const app = spawn(process.execPath, [nextBin, "start", "-p", String(APP_PORT)], {
  cwd: root,
  env: {
    ...process.env,
    STORAGE_DRIVER: "github",
    GITHUB_TOKEN: "test-token",
    GITHUB_OWNER: "prime",
    GITHUB_REPO: "prime-tv",
    GITHUB_BRANCH: "main",
    GITHUB_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let appLog = "";
app.stdout.on("data", (d) => (appLog += d));
app.stderr.on("data", (d) => (appLog += d));

const stop = () => {
  app.kill();
  mock.server.close();
};
process.on("exit", stop);

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

let cookie = "";
const call = async (method, url, body) => {
  const headers = { Origin: BASE };
  if (cookie) headers.Cookie = cookie;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
};

let ok = 0;
const step = async (name, fn) => {
  try {
    await fn();
    ok++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}\n--- log do app ---\n${appLog.slice(-1500)}`);
    stop();
    process.exit(1);
  }
};

console.log("\nArmazenamento GitHub (simulador da API):");
let draft;
await step("login e leitura do rascunho a partir do repositório", async () => {
  const r = await call("POST", "/api/admin/login", { username: USER, password: PASS });
  assert.equal(r.status, 200, r.text);
  cookie = r.headers.get("set-cookie").split(";")[0];
  const d = await call("GET", "/api/admin/draft");
  assert.equal(d.status, 200, d.text);
  assert.equal(d.json.storage.kind, "github");
  assert.equal(d.json.storage.repo, "prime/prime-tv");
  draft = d.json.draft;
});

await step("salvar rascunho gera um commit apenas com data/draft.json", async () => {
  draft.settings.fallback.message = "Estética Avançada · teste GitHub";
  const r = await call("PUT", "/api/admin/draft", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
  const last = mock.log.at(-1);
  assert.deepEqual(last.changed, ["data/draft.json"]);
  assert.match(last.message, /rascunho salvo/);
  assert.equal(JSON.parse(mock.read("data/draft.json")).meta.revision, draft.meta.revision);
});

await step("commit concorrente durante a gravação é tratado (nova tentativa sem sobrescrever)", async () => {
  mock.failNextRefUpdate(1);
  draft.settings.fallback.title = "Prime Esthetics";
  const r = await call("PUT", "/api/admin/draft", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
  assert.equal(mock.log.at(-1).changed.join(","), "data/draft.json");
});

await step("revisão desatualizada é recusada (409)", async () => {
  const r = await call("PUT", "/api/admin/draft", { draft, baseRevision: draft.meta.revision - 1 });
  assert.equal(r.status, 409);
});

let uploadedPath;
await step("envio de mídia grava o arquivo em public/media com um commit", async () => {
  const bytes = fs.readFileSync(path.join(root, "public/media/seed/preenchimento-labial-foto.webp"));
  const form = new FormData();
  form.append("name:a1", "Foto enviada");
  form.append("media:a1", new Blob([bytes], { type: "image/webp" }), "foto.webp");
  form.append("original:a1", new Blob([bytes], { type: "image/webp" }), "original.webp");
  const r = await call("POST", "/api/admin/upload", form);
  assert.equal(r.status, 200, r.text);
  uploadedPath = r.json.files[0].path;
  const last = mock.log.at(-1);
  assert.ok(last.changed.includes(`public/${uploadedPath}`));
  assert.ok(last.changed.some((c) => c.startsWith("archive/originals/")));
  assert.equal(last.changed.length, 2);
});

await step("mídia ainda não publicada é exibida no painel pela rota autenticada", async () => {
  const res = await fetch(`${BASE}/api/admin/media-file/${uploadedPath}`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
  const anon = await fetch(`${BASE}/api/admin/media-file/${uploadedPath}`);
  assert.equal(anon.status, 401);
});

await step("arquivo enviado sem cadastro aparece em “arquivos sem cadastro”", async () => {
  const r = await call("GET", "/api/admin/media/orphans");
  assert.ok(r.json.orphans.some((o) => o.path === uploadedPath));
});

let version;
await step("publicar grava store.json e draft.json em UM commit", async () => {
  const now = new Date().toISOString();
  draft.media.unshift({
    id: "med_gh",
    kind: "image",
    storage: "repo",
    path: uploadedPath,
    name: "Foto enviada",
    category: "procedimento",
    tags: [],
    width: 904,
    height: 920,
    bytes: 1,
    mime: "image/webp",
    hasText: false,
    focalX: 50,
    focalY: 50,
    status: "active",
    clinical: { isClinical: false, consent: "pending" },
    createdAt: now,
    updatedAt: now,
  });
  draft.slides.find((s) => s.id === "sl_labial_destaque").data.mediaId = "med_gh";
  const r = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  version = r.json.version;
  draft.meta.revision = r.json.revision;
  const last = mock.log.at(-1);
  assert.deepEqual([...last.changed].sort(), ["data/draft.json", "data/store.json"]);
  assert.equal(r.json.commit, last.sha);
  const store = JSON.parse(mock.read("data/store.json"));
  assert.equal(store.meta.version, version);
  assert.equal(store.meta.lastPublish, undefined);
  assert.equal(JSON.parse(mock.read("data/draft.json")).meta.lastPublish.version, version);
});

await step("status da publicação não confirma antes do deploy servir a nova versão", async () => {
  const st = await call("GET", `/api/admin/publish/status?version=${version}&commit=${mock.head()}`);
  assert.equal(st.json.state, "deploying");
  const tv = await call("GET", "/api/version");
  assert.notEqual(tv.json.version, version, "a TV só muda após o novo deploy");
});

await step("publicação com mídia ausente no repositório é bloqueada", async () => {
  const broken = structuredClone(draft);
  broken.media.find((m) => m.id === "med_gh").path = "media/2026/10/nao-existe-abc123.webp";
  const r = await call("POST", "/api/admin/publish", { draft: broken, baseRevision: draft.meta.revision });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, "missing-media");
});

await step("exclusão de arquivo em uso é recusada; sem uso, é removido", async () => {
  const blocked = await call("DELETE", "/api/admin/media", { paths: [uploadedPath] });
  assert.equal(blocked.status, 409);
  const seedUnused = "media/seed/condicao-especial-30-off.webp";
  // remove o cadastro do rascunho e da publicação antes de excluir
  draft.media = draft.media.filter((m) => m.path !== seedUnused);
  const used = new Set(draft.media.map((m) => m.id));
  draft.slides = draft.slides.filter((s) => !s.data.mediaId || used.has(s.data.mediaId));
  for (const c of draft.campaigns) c.items = c.items.filter((i) => draft.slides.some((s) => s.id === i.slideId));
  const pub = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(pub.status, 200, pub.text);
  draft.meta.revision = pub.json.revision;
  const del = await call("DELETE", "/api/admin/media", { paths: [seedUnused] });
  assert.equal(del.status, 200, del.text);
  assert.equal(mock.read(`public/${seedUnused}`), null);
});

await step("caminhos fora das pastas de conteúdo são recusados", async () => {
  const r = await call("DELETE", "/api/admin/media", { paths: ["../package.json"] });
  assert.equal(r.status, 400);
});

console.log(`\n${ok} verificações do GitHub concluídas com sucesso.\n`);
stop();
process.exit(0);
