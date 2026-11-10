#!/usr/bin/env node
/**
 * Teste de ponta a ponta dos fluxos principais contra um servidor em execução.
 *
 *   BASE_URL=http://localhost:3210 ADMIN_USER=admin ADMIN_PASSWORD=... npm run test:smoke
 *
 * ATENÇÃO: grava no conteúdo (rascunho, publicação e mídias). Use em ambiente local
 * (STORAGE_DRIVER=local) ou em um repositório de testes, nunca no repositório de produção.
 * Depois do teste local, restaure os dados com: npm run seed:reset
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://localhost:3210").replace(/\/$/, "");
const USER = process.env.ADMIN_USER || "admin";
const PASS = process.env.ADMIN_PASSWORD;
if (!PASS) {
  console.error("Defina ADMIN_PASSWORD para executar o teste.");
  process.exit(1);
}

let cookie = "";
let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n    ") : e}`);
    process.exitCode = 1;
    throw e;
  }
};

async function call(method, url, body, opts = {}) {
  const headers = { Origin: BASE, ...(opts.headers || {}) };
  if (cookie && !opts.anonymous) headers.Cookie = cookie;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* não-JSON */
  }
  return { status: res.status, json, headers: res.headers, text };
}

/** Compila os módulos puros de agenda/ciclo para testá-los diretamente. */
async function loadLogic() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "primetv-logic-"));
  for (const name of ["schedule", "cycle"]) {
    const src = fs.readFileSync(path.join(root, "src", "lib", `${name}.ts`), "utf8");
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
    js = js.replace(/from "\.\/(schedule|cycle|manifest|schema)"/g, (_m, n) => `from "./${n}.mjs"`);
    fs.writeFileSync(path.join(out, `${name}.mjs`), js);
  }
  // Tipos apenas: módulos vazios para manifest/schema.
  fs.writeFileSync(path.join(out, "manifest.mjs"), "export {};");
  fs.writeFileSync(path.join(out, "schema.mjs"), "export {};");
  return {
    schedule: await import(pathToFileURL(path.join(out, "schedule.mjs")).href),
    cycle: await import(pathToFileURL(path.join(out, "cycle.mjs")).href),
  };
}

console.log(`\nPrime TV — teste de fluxos em ${BASE}\n`);

const logic = await loadLogic();
console.log("Agenda e ciclo (lógica pura):");
await step("período, dias da semana e janela que atravessa a meia-noite", () => {
  const { localParts, isScheduleActive, campaignPhase, zonedStampToDate } = logic.schedule;
  const tz = "America/Bahia";
  const at = (stamp) => localParts(zonedStampToDate(stamp, tz), tz);
  assert.equal(at("2026-11-20T10:00").stamp, "2026-11-20T10:00");
  const s = { startAt: "2026-11-20T00:00", endAt: "2026-11-28T00:00" };
  assert.equal(isScheduleActive(s, at("2026-11-19T23:59")), false);
  assert.equal(isScheduleActive(s, at("2026-11-20T00:00")), true);
  assert.equal(isScheduleActive(s, at("2026-11-28T00:00")), false);
  assert.equal(campaignPhase({ status: "active", schedule: s }, at("2026-11-01T12:00")), "scheduled");
  assert.equal(campaignPhase({ status: "active", schedule: s }, at("2026-11-21T12:00")), "live");
  assert.equal(campaignPhase({ status: "active", schedule: s }, at("2026-12-01T12:00")), "ended");
  assert.equal(campaignPhase({ status: "paused", schedule: s }, at("2026-11-21T12:00")), "paused");
  // 2026-11-21 é sábado (6)
  assert.equal(isScheduleActive({ weekdays: [1, 2, 3, 4, 5] }, at("2026-11-21T12:00")), false);
  assert.equal(isScheduleActive({ weekdays: [6] }, at("2026-11-21T12:00")), true);
  const night = { timeStart: "18:00", timeEnd: "02:00" };
  assert.equal(isScheduleActive(night, at("2026-11-21T23:30")), true);
  assert.equal(isScheduleActive(night, at("2026-11-21T01:30")), true);
  assert.equal(isScheduleActive(night, at("2026-11-21T12:00")), false);
});

const tinyManifest = (campaigns, main) => ({
  manifestVersion: 1,
  version: "t",
  unit: { id: "u1", code: "u", name: "U", active: true, orientation: "portrait", rotation: 0, overscanPercent: 0, autoCampaignEvery: 0 },
  settings: { timezone: "America/Bahia", defaultDurationSec: 8, defaultTransition: "dissolve", transitionMs: 1000 },
  slides: Object.fromEntries(
    ["a", "b", "c", "p1", "p2", "q1", "fb"].map((id) => [id, { id, durationSec: 5, transition: "fade", media: {} }]),
  ),
  main,
  fallback: [],
  campaigns,
});

await step("espaços de campanha alternam peças e respeitam o período", () => {
  const { buildCycle, newRotation } = logic.cycle;
  const { zonedStampToDate } = logic.schedule;
  const main = [
    { kind: "slide", key: "1", slideId: "a" },
    { kind: "campaign", key: "2", campaignIds: [], fallbackSlideId: "fb", durationSec: 9 },
    { kind: "slide", key: "3", slideId: "b" },
    { kind: "campaign", key: "4", campaignIds: [], fallbackSlideId: "fb" },
  ];
  const camp = {
    id: "c1",
    name: "C1",
    schedule: { startAt: "2026-11-20T00:00", endAt: "2026-11-28T00:00" },
    priority: 5,
    weight: 1,
    items: [{ slideId: "p1" }, { slideId: "p2" }],
  };
  const m = tinyManifest([camp], main);
  const before = buildCycle(m, zonedStampToDate("2026-11-10T10:00", "America/Bahia"), newRotation());
  assert.deepEqual(
    before.map((e) => e.slideId),
    ["a", "fb", "b", "fb"],
  );
  assert.equal(before[1].durationSec, 9);
  const rot = newRotation();
  const during = buildCycle(m, zonedStampToDate("2026-11-21T10:00", "America/Bahia"), rot);
  assert.deepEqual(
    during.map((e) => e.slideId),
    ["a", "p1", "b", "p2"],
  );
  const next = buildCycle(m, zonedStampToDate("2026-11-21T10:05", "America/Bahia"), rot);
  assert.deepEqual(
    next.map((e) => e.slideId),
    ["a", "p1", "b", "p2"],
  );
  const after = buildCycle(m, zonedStampToDate("2026-11-29T10:00", "America/Bahia"), newRotation());
  assert.deepEqual(
    after.map((e) => e.slideId),
    ["a", "fb", "b", "fb"],
  );
});

await step("peso define a frequência entre campanhas simultâneas", () => {
  const { buildCycle, newRotation } = logic.cycle;
  const slots = Array.from({ length: 8 }, (_, i) => ({ kind: "campaign", key: `s${i}`, campaignIds: [] }));
  const heavy = { id: "h", name: "H", schedule: {}, priority: 5, weight: 3, items: [{ slideId: "p1" }] };
  const light = { id: "l", name: "L", schedule: {}, priority: 5, weight: 1, items: [{ slideId: "q1" }] };
  const out = buildCycle(tinyManifest([heavy, light], slots), new Date(), newRotation());
  assert.equal(out.filter((e) => e.campaignId === "h").length, 6);
  assert.equal(out.filter((e) => e.campaignId === "l").length, 2);
});

await step("peças com falha são puladas e a programação institucional assume se nada sobrar", () => {
  const { buildCycle, newRotation } = logic.cycle;
  const m = tinyManifest(
    [],
    [
      { kind: "slide", key: "1", slideId: "a" },
      { kind: "slide", key: "2", slideId: "b" },
    ],
  );
  m.fallback = [{ kind: "slide", key: "f", slideId: "c" }];
  assert.deepEqual(
    buildCycle(m, new Date(), newRotation(), { skip: (id) => id === "a" }).map((e) => e.slideId),
    ["b"],
  );
  assert.deepEqual(
    buildCycle(m, new Date(), newRotation(), { skip: (id) => id !== "c" }).map((e) => e.slideId),
    ["c"],
  );
});

console.log("\nSegurança:");
await step("área administrativa exige autenticação", async () => {
  assert.equal((await call("GET", "/api/admin/draft", null, { anonymous: true })).status, 401);
  const page = await call("GET", "/admin/programacao", null, { anonymous: true });
  assert.ok([302, 303, 307, 308].includes(page.status), `esperado redirecionamento, veio ${page.status}`);
  assert.match(page.headers.get("location") || "", /\/admin\/login/);
  assert.equal((await call("POST", "/api/admin/publish", { draft: {}, baseRevision: 0 }, { anonymous: true })).status, 401);
  assert.equal((await call("POST", "/api/admin/upload", new FormData(), { anonymous: true })).status, 401);
});
await step("senha incorreta é recusada", async () => {
  const r = await call("POST", "/api/admin/login", { username: USER, password: "senha-errada-123" });
  assert.equal(r.status, 401);
});
await step("login cria cookie HttpOnly", async () => {
  const r = await call("POST", "/api/admin/login", { username: USER, password: PASS });
  assert.equal(r.status, 200, r.text);
  const set = r.headers.get("set-cookie") || "";
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=Lax/i);
  cookie = set.split(";")[0];
});
await step("escrita de outra origem é bloqueada", async () => {
  const r = await call("PUT", "/api/admin/draft", { draft: {}, baseRevision: 0 }, { headers: { Origin: "https://example.com" } });
  assert.equal(r.status, 403);
});

console.log("\nFluxo de conteúdo:");
let draft;
let tvBefore;
await step("abrir o rascunho e a TV publicada", async () => {
  const r = await call("GET", "/api/admin/draft");
  assert.equal(r.status, 200, r.text);
  draft = r.json.draft;
  const tv = await call("GET", "/api/tv/unidade-centro", null, { anonymous: true });
  assert.equal(tv.status, 200);
  tvBefore = tv.json;
  assert.ok(tvBefore.main.length >= 10, "a programação demonstrativa deve ter as 12 telas");
});

await step("conflito de edição é detectado (revisão antiga)", async () => {
  const r = await call("PUT", "/api/admin/draft", { draft, baseRevision: draft.meta.revision - 1 });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "conflict");
});

let uploaded;
await step("enviar uma imagem pelo navegador (multipart) e validar o tipo real", async () => {
  const bytes = fs.readFileSync(path.join(root, "public/media/seed/microvasos-foto.webp"));
  const form = new FormData();
  form.append("name:t1", "Teste de envio");
  form.append("media:t1", new Blob([bytes], { type: "image/webp" }), "teste.webp");
  const r = await call("POST", "/api/admin/upload", form);
  assert.equal(r.status, 200, r.text);
  uploaded = r.json.files[0];
  assert.match(uploaded.path, /^media\/\d{4}\/\d{2}\/teste-de-envio-[a-z0-9]{6}\.webp$/);
  const fake = new FormData();
  fake.append("media:t2", new Blob([Buffer.from("<script>alert(1)</script> nao e imagem")], { type: "image/png" }), "x.png");
  const bad = await call("POST", "/api/admin/upload", fake);
  assert.equal(bad.status, 415);
});

const now = new Date().toISOString();
const artId = "sl_teste_envio";
await step("inserir a imagem na programação, mudar posição e duração e salvar rascunho", async () => {
  draft.media.unshift({
    id: "med_teste_envio",
    kind: "image",
    storage: "repo",
    path: uploaded.path,
    name: "Teste de envio",
    category: "procedimento",
    tags: [],
    width: 1740,
    height: 890,
    bytes: uploaded.bytes,
    mime: uploaded.mime,
    hasText: false,
    focalX: 50,
    focalY: 50,
    status: "active",
    clinical: { isClinical: false, consent: "pending" },
    createdAt: now,
    updatedAt: now,
  });
  draft.slides.unshift({
    id: artId,
    name: "Teste — arte enviada",
    type: "art",
    durationSec: 10,
    transition: "dissolve",
    status: "active",
    createdAt: now,
    updatedAt: now,
    data: { mediaId: "med_teste_envio", background: "brand", kenBurns: false, showDisclaimer: false },
  });
  const pl = draft.playlists.find((p) => p.id === "pl_principal");
  pl.items.splice(1, 0, { id: "it_teste", kind: "slide", slideId: artId, durationSec: 6, hidden: false });
  const r = await call("PUT", "/api/admin/draft", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
});

await step("rascunho salvo não altera a TV", async () => {
  const tv = await call("GET", "/api/tv/unidade-centro", null, { anonymous: true });
  assert.equal(tv.json.version, tvBefore.version);
  assert.ok(!tv.json.slides[artId]);
});

await step("publicação bloqueada por erro de validação mostra mensagens reais", async () => {
  const broken = structuredClone(draft);
  broken.units.push({ ...broken.units[0], id: "un_dup" });
  const r = await call("POST", "/api/admin/publish", { draft: broken, baseRevision: draft.meta.revision });
  assert.equal(r.status, 422);
  assert.ok(r.json.details.some((d) => /mesmo código/.test(d.message)));
});

let version;
await step("publicar e confirmar a nova versão no ar", async () => {
  const r = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  version = r.json.version;
  draft.meta.revision = r.json.revision;
  const st = await call("GET", `/api/admin/publish/status?version=${version}&commit=${r.json.commit}`);
  assert.equal(st.json.state, "published");
  const v = await call("GET", "/api/version", null, { anonymous: true });
  assert.equal(v.json.version, version);
});

await step("a TV recebe a peça na nova posição e com a nova duração", async () => {
  const tv = await call("GET", "/api/tv/unidade-centro", null, { anonymous: true });
  assert.equal(tv.json.version, version);
  assert.equal(tv.json.main[1].slideId, artId);
  assert.equal(tv.json.main[1].durationSec, 6);
  const url = tv.json.slides[artId].media.med_teste_envio.url;
  const img = await fetch(BASE + url);
  assert.equal(img.status, 200);
});

await step("cadastrar uma segunda unidade com programação diferente", async () => {
  draft.playlists.push({
    id: "pl_teste",
    name: "Programação de teste",
    description: "",
    items: [
      { id: "it_t1", kind: "slide", slideId: artId, hidden: false },
      { id: "it_t2", kind: "slide", slideId: "sl_contato", hidden: false },
    ],
  });
  draft.units.push({
    id: "un_teste",
    code: "unidade-teste",
    name: "Unidade Teste",
    orientation: "landscape",
    rotation: 0,
    overscanPercent: 0,
    playlistId: "pl_teste",
    autoCampaignEvery: 0,
    active: true,
    whatsapp: "5571900000000",
  });
  const r = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
  const a = (await call("GET", "/api/tv/unidade-teste", null, { anonymous: true })).json;
  const b = (await call("GET", "/api/tv/unidade-centro", null, { anonymous: true })).json;
  assert.equal(a.unit.orientation, "landscape");
  assert.deepEqual(
    a.main.map((e) => e.slideId),
    [artId, "sl_contato"],
  );
  assert.notDeepEqual(
    a.main.map((e) => e.slideId),
    b.main.map((e) => e.slideId),
  );
});

await step("campanha programada por período chega à TV com o período", async () => {
  draft.campaigns.push({
    id: "cmp_teste",
    name: "Campanha de teste",
    description: "",
    status: "active",
    theme: "",
    schedule: { startAt: "2030-01-01T00:00", endAt: "2030-01-31T23:59" },
    scope: "units",
    unitIds: ["un_teste"],
    items: [{ slideId: artId }],
    priority: 5,
    weight: 1,
    createdAt: now,
    updatedAt: now,
  });
  const r = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
  const a = (await call("GET", "/api/tv/unidade-teste", null, { anonymous: true })).json;
  const b = (await call("GET", "/api/tv/unidade-centro", null, { anonymous: true })).json;
  assert.ok(a.campaigns.some((c) => c.id === "cmp_teste" && c.schedule.startAt === "2030-01-01T00:00"));
  assert.ok(!b.campaigns.some((c) => c.id === "cmp_teste"), "campanha restrita não deve ir para outra unidade");
});

await step("fotografia clínica sem autorização não vai para a TV", async () => {
  const m = draft.media.find((x) => x.id === "med_teste_envio");
  m.clinical = { isClinical: true, consent: "pending" };
  const r = await call("POST", "/api/admin/publish", { draft, baseRevision: draft.meta.revision });
  assert.equal(r.status, 200, r.text);
  draft.meta.revision = r.json.revision;
  const tv = (await call("GET", "/api/tv/unidade-centro", null, { anonymous: true })).json;
  assert.ok(!tv.slides[artId]);
  assert.ok(!tv.main.some((e) => e.slideId === artId));
});

await step("unidade inexistente responde 404 (TV mostra contingência)", async () => {
  assert.equal((await call("GET", "/api/tv/nao-existe", null, { anonymous: true })).status, 404);
});

await step("sair encerra a sessão", async () => {
  const r = await call("POST", "/api/admin/logout");
  assert.match(r.headers.get("set-cookie") || "", /Max-Age=0/);
  cookie = "";
  assert.equal((await call("GET", "/api/admin/draft")).status, 401);
});

console.log(`\n${passed} verificações concluídas com sucesso.\n`);
