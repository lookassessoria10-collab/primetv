#!/usr/bin/env node
/**
 * Executado antes do dev/build: registra quais mídias fazem parte deste deploy.
 * O painel usa a lista para saber se uma mídia recém-enviada já está publicada
 * ou se deve ser exibida pela rota autenticada de pré-visualização.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = path.join(root, "public", "media");

function walk(dir, rel = "media") {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), childRel));
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

const info = {
  builtAt: new Date().toISOString(),
  commit: process.env.VERCEL_GIT_COMMIT_SHA || "",
  mediaFiles: walk(mediaDir).sort(),
};

const outDir = path.join(root, "src", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "build-info.json"), JSON.stringify(info, null, 2) + "\n");

// Garante que o rascunho exista (cópia da versão publicada) em instalações novas.
const draft = path.join(root, "data", "draft.json");
const store = path.join(root, "data", "store.json");
if (!fs.existsSync(draft) && fs.existsSync(store)) fs.copyFileSync(store, draft);

console.log(`[prime-tv] build-info: ${info.mediaFiles.length} mídia(s) neste deploy.`);
