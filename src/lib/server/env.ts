import "server-only";

/** Leitura centralizada das variáveis de ambiente (somente no servidor). */
export const env = {
  get githubToken() {
    return process.env.GITHUB_TOKEN || "";
  },
  get githubOwner() {
    return process.env.GITHUB_OWNER || "";
  },
  get githubRepo() {
    return process.env.GITHUB_REPO || "";
  },
  get githubBranch() {
    return process.env.GITHUB_BRANCH || "main";
  },
  get githubApiUrl() {
    return (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
  },
  get adminUser() {
    return process.env.ADMIN_USER || "";
  },
  get adminPasswordHash() {
    return process.env.ADMIN_PASSWORD_HASH || "";
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET || "";
  },
  get appUrl() {
    return (process.env.APP_URL || "").replace(/\/$/, "");
  },
  /** "github" (produção) ou "local" (desenvolvimento, grava no disco). */
  get storageDriver(): "github" | "local" | "none" {
    const forced = process.env.STORAGE_DRIVER;
    if (forced === "local" || forced === "github") return forced;
    if (this.githubToken && this.githubOwner && this.githubRepo) return "github";
    if (process.env.NODE_ENV !== "production") return "local";
    return "none";
  },
  get isVercel() {
    return Boolean(process.env.VERCEL);
  },
  get commitSha() {
    return process.env.VERCEL_GIT_COMMIT_SHA || "";
  },
  get deploymentId() {
    return process.env.VERCEL_DEPLOYMENT_ID || "";
  },
};

export function missingAuthConfig(): string[] {
  const missing: string[] = [];
  if (!env.adminUser) missing.push("ADMIN_USER");
  if (!env.adminPasswordHash) missing.push("ADMIN_PASSWORD_HASH");
  if (env.sessionSecret.length < 32) missing.push("SESSION_SECRET (mínimo de 32 caracteres)");
  return missing;
}

export function missingStorageConfig(): string[] {
  if (env.storageDriver === "local") return [];
  const missing: string[] = [];
  if (!env.githubToken) missing.push("GITHUB_TOKEN");
  if (!env.githubOwner) missing.push("GITHUB_OWNER");
  if (!env.githubRepo) missing.push("GITHUB_REPO");
  return missing;
}
