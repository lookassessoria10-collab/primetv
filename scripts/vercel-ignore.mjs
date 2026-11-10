#!/usr/bin/env node
/**
 * "Ignored Build Step" do Vercel (vercel.json → ignoreCommand).
 * Salvar rascunho e enviar mídias geram commits que NÃO precisam de deploy:
 * a TV só muda quando data/store.json (publicação) ou o código mudam.
 *   exit 0 → o Vercel ignora o deploy
 *   exit 1 → o Vercel faz o deploy (padrão em qualquer dúvida)
 */
import { execSync } from "node:child_process";

const CONTENT_ONLY = (file) => file === "data/draft.json" || file.startsWith("public/media/") || file.startsWith("archive/");

function git(cmd) {
  return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
}

try {
  const current = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";
  let base = process.env.VERCEL_GIT_PREVIOUS_SHA || "";
  try {
    if (!base) throw new Error("sem deploy anterior");
    if (git(`cat-file -t ${base}`).trim() !== "commit") throw new Error("commit anterior indisponível");
  } catch {
    base = `${current}~1`;
  }
  const files = git(`diff --name-only ${base} ${current}`)
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  if (files.length > 0 && files.every(CONTENT_ONLY)) {
    console.log(`[prime-tv] Somente rascunho/mídias alterados (${files.length} arquivo(s)): deploy ignorado.`);
    process.exit(0);
  }
  console.log(`[prime-tv] Alterações publicáveis detectadas: deploy necessário.`);
  process.exit(1);
} catch (e) {
  console.log(`[prime-tv] Não foi possível comparar commits (${e.message}); seguindo com o deploy.`);
  process.exit(1);
}
