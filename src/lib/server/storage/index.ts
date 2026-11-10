import "server-only";
import { env, missingStorageConfig } from "../env";
import { HttpError } from "../http";
import { GitHubStorage } from "./github";
import { LocalStorage } from "./local";
import type { ContentStorage } from "./types";

let cached: { key: string; storage: ContentStorage } | null = null;

export function getStorage(): ContentStorage {
  const driver = env.storageDriver;
  if (driver === "none") {
    throw new HttpError(
      503,
      `Armazenamento não configurado. Defina ${missingStorageConfig().join(", ")} nas variáveis de ambiente.`,
      "storage-not-configured",
    );
  }
  const key = driver === "github" ? `gh:${env.githubOwner}/${env.githubRepo}@${env.githubBranch}` : `local:${process.cwd()}`;
  if (cached?.key === key) return cached.storage;
  const storage: ContentStorage =
    driver === "github"
      ? new GitHubStorage({
          token: env.githubToken,
          owner: env.githubOwner,
          repo: env.githubRepo,
          branch: env.githubBranch,
          apiUrl: env.githubApiUrl,
        })
      : new LocalStorage(process.cwd());
  cached = { key, storage };
  return storage;
}

export * from "./types";
