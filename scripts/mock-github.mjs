#!/usr/bin/env node
/**
 * Simulador mínimo da API do GitHub (Git Data API + Contents) para testes locais.
 * Não é usado em produção. Implementa apenas o que a Prime TV utiliza.
 *
 *   node scripts/mock-github.mjs [porta]      (padrão 4010, token esperado: "test-token")
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createMockGitHub({ root, token = "test-token", branch = "main" }) {
  const blobs = new Map(); // sha -> Buffer
  const trees = new Map(); // sha -> Map(path -> blobSha)
  const commits = new Map(); // sha -> { tree, parents, message }
  const refs = new Map(); // branch -> commit sha
  const log = []; // commits criados (para os testes)
  let failNextRefUpdate = 0;

  const sha = (data) => crypto.createHash("sha1").update(data).digest("hex");
  const putBlob = (buf) => {
    const s = sha(Buffer.concat([Buffer.from("blob"), buf]));
    blobs.set(s, buf);
    return s;
  };
  const putTree = (map) => {
    const s = sha(JSON.stringify([...map.entries()].sort()));
    trees.set(s, map);
    return s;
  };
  const putCommit = (c) => {
    const s = sha(JSON.stringify(c) + Math.random());
    commits.set(s, c);
    return s;
  };

  // Commit inicial com os arquivos de conteúdo do projeto.
  const initial = new Map();
  const add = (rel) => initial.set(rel.replace(/\\/g, "/"), putBlob(fs.readFileSync(path.join(root, rel))));
  for (const f of ["data/store.json", "data/draft.json"]) if (fs.existsSync(path.join(root, f))) add(f);
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else add(rel);
    }
  };
  if (fs.existsSync(path.join(root, "public/media"))) walk("public/media");
  refs.set(branch, putCommit({ tree: putTree(initial), parents: [], message: "inicial" }));

  const json = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { message: "Bad credentials" });
    const url = new URL(req.url, "http://x");
    const m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)$/);
    if (!m) return json(res, 404, { message: "Not Found" });
    const p = m[1];
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};

    if (req.method === "GET" && p === `/git/ref/heads/${branch}`) return json(res, 200, { object: { sha: refs.get(branch) } });
    let g;
    if (req.method === "GET" && (g = p.match(/^\/git\/commits\/([0-9a-f]+)$/))) {
      const c = commits.get(g[1]);
      return c ? json(res, 200, { sha: g[1], tree: { sha: c.tree }, parents: c.parents.map((s) => ({ sha: s })) }) : json(res, 404, {});
    }
    if (req.method === "GET" && (g = p.match(/^\/git\/trees\/([0-9a-f]+)$/))) {
      const t = trees.get(g[1]);
      if (!t) return json(res, 404, {});
      return json(res, 200, {
        sha: g[1],
        truncated: false,
        tree: [...t.entries()].map(([path, s]) => ({ path, type: "blob", sha: s, size: blobs.get(s).length })),
      });
    }
    if (req.method === "POST" && p === "/git/blobs")
      return json(res, 201, { sha: putBlob(Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8")) });
    if (req.method === "POST" && p === "/git/trees") {
      const base = trees.get(data.base_tree);
      if (!base) return json(res, 422, { message: "base_tree inválida" });
      const next = new Map(base);
      for (const e of data.tree) {
        if (e.sha === null) {
          if (!next.has(e.path)) return json(res, 422, { message: `Caminho inexistente: ${e.path}` });
          next.delete(e.path);
        } else next.set(e.path, e.sha);
      }
      return json(res, 201, { sha: putTree(next) });
    }
    if (req.method === "POST" && p === "/git/commits") {
      const s = putCommit({ tree: data.tree, parents: data.parents, message: data.message });
      return json(res, 201, { sha: s, html_url: `https://github.com/mock/commit/${s}` });
    }
    if (req.method === "PATCH" && p === `/git/refs/heads/${branch}`) {
      const c = commits.get(data.sha);
      if (failNextRefUpdate > 0) {
        failNextRefUpdate--;
        // Simula outro commit chegando no meio da operação.
        const head = refs.get(branch);
        const t = new Map(trees.get(commits.get(head).tree));
        const other = putCommit({ tree: putTree(t), parents: [head], message: "commit concorrente simulado" });
        refs.set(branch, other);
        return json(res, 422, { message: "Update is not a fast forward" });
      }
      if (!c || c.parents[0] !== refs.get(branch)) return json(res, 422, { message: "Update is not a fast forward" });
      refs.set(branch, data.sha);
      const parentTree = trees.get(commits.get(c.parents[0]).tree);
      const tree = trees.get(c.tree);
      const changed = [...new Set([...parentTree.keys(), ...tree.keys()])].filter((k) => parentTree.get(k) !== tree.get(k));
      log.push({ sha: data.sha, message: c.message, changed });
      return json(res, 200, { object: { sha: data.sha } });
    }
    if (req.method === "GET" && (g = p.match(/^\/contents\/(.+)$/))) {
      const ref = url.searchParams.get("ref") || branch;
      const commitSha = refs.get(ref) || ref;
      const c = commits.get(commitSha);
      const t = c && trees.get(c.tree);
      const file = t && t.get(decodeURIComponent(g[1]));
      if (!file) return json(res, 404, { message: "Not Found" });
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      return res.end(blobs.get(file));
    }
    if (req.method === "GET" && p.startsWith("/deployments")) return json(res, 200, []);
    if (req.method === "GET" && /^\/commits\/[0-9a-f]+\/status$/.test(p)) return json(res, 200, { state: "pending", statuses: [] });
    return json(res, 404, { message: `Não implementado: ${req.method} ${p}` });
  });

  return {
    server,
    log,
    head: () => refs.get(branch),
    read: (file) => {
      const t = trees.get(commits.get(refs.get(branch)).tree);
      const s = t.get(file);
      return s ? blobs.get(s) : null;
    },
    failNextRefUpdate: (n = 1) => (failNextRefUpdate = n),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const port = Number(process.argv[2] || 4010);
  createMockGitHub({ root }).server.listen(port, () => console.log(`Mock GitHub em http://127.0.0.1:${port} (token: test-token)`));
}
