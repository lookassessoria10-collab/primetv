import "server-only";
import fs from "node:fs";
import path from "node:path";
import bundledStore from "../../../data/store.json";
import buildInfo from "../../generated/build-info.json";
import { parseStore, type Store } from "../schema";
import { env } from "./env";

/**
 * Programação publicada.
 * Em produção vem do data/store.json incluído no build: cada deploy do Vercel carrega
 * exatamente a versão do commit publicado, e a troca de versão é atômica.
 * No modo local é lida do disco a cada chamada.
 */

let memo: Store | null = null;

export function getPublishedStore(): Store {
  if (env.storageDriver === "local") {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "store.json"), "utf8");
    return parseStore(JSON.parse(raw));
  }
  if (!memo) memo = parseStore(bundledStore);
  return memo;
}

export interface BuildInfo {
  builtAt: string;
  commit: string;
  mediaFiles: string[];
}

/** Arquivos de mídia presentes neste deploy (gerado por scripts/build-info.mjs). */
export function getBuildInfo(): BuildInfo {
  return buildInfo as BuildInfo;
}
