import "server-only";
import {
  assertReadablePath,
  assertWritablePath,
  HeadMovedError,
  StorageError,
  type CommitResult,
  type ContentStorage,
  type DeployStatus,
  type ListedFile,
  type RepoFile,
} from "./types";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  apiUrl: string;
}

/**
 * Persistência no GitHub usando a Git Data API:
 * blobs → árvore (base_tree) → commit → atualização do ramo sem "force".
 * Todas as alterações de uma operação entram em um único commit, e a atualização
 * do ramo falha se outro commit chegou antes (evita sobrescrever alterações).
 */
export class GitHubStorage implements ContentStorage {
  readonly kind = "github" as const;

  constructor(private cfg: GitHubConfig) {}

  describe() {
    return {
      kind: this.kind,
      repo: `${this.cfg.owner}/${this.cfg.repo}`,
      branch: this.cfg.branch,
      commitUrlBase: `https://github.com/${this.cfg.owner}/${this.cfg.repo}/commit/`,
    };
  }

  private get base() {
    return `${this.cfg.apiUrl}/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}`;
  }

  private async request(path: string, init: RequestInit & { accept?: string } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.cfg.token}`);
    headers.set("Accept", init.accept || "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("User-Agent", "prime-tv-cms");
    if (init.body) headers.set("Content-Type", "application/json");
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { ...init, headers, cache: "no-store" });
    } catch {
      throw new StorageError("Não foi possível conectar à API do GitHub.");
    }
    return res;
  }

  private async fail(res: Response, action: string): Promise<never> {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ? ` (${body.message})` : "";
    } catch {
      /* corpo não-JSON */
    }
    if (res.status === 401) throw new StorageError(`GitHub recusou o token ao ${action}. Verifique GITHUB_TOKEN${detail}.`, 502);
    if (res.status === 403) throw new StorageError(`Sem permissão no GitHub para ${action}${detail}. Confira as permissões do token.`, 502);
    if (res.status === 404) throw new StorageError(`Repositório, ramo ou arquivo não encontrado ao ${action}${detail}.`, 502);
    throw new StorageError(`Falha no GitHub ao ${action}: HTTP ${res.status}${detail}`, 502);
  }

  private async getJson<T>(path: string, action: string): Promise<T> {
    const res = await this.request(path);
    if (!res.ok) await this.fail(res, action);
    return (await res.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown, action: string, method = "POST"): Promise<T> {
    const res = await this.request(path, { method, body: JSON.stringify(body) });
    if (!res.ok) await this.fail(res, action);
    return (await res.json()) as T;
  }

  async head(): Promise<string> {
    const ref = await this.getJson<{ object: { sha: string } }>(
      `/git/ref/heads/${encodeURIComponent(this.cfg.branch)}`,
      `ler o ramo ${this.cfg.branch}`,
    );
    return ref.object.sha;
  }

  private contentsPath(path: string, ref?: string) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `/contents/${encoded}?ref=${encodeURIComponent(ref || this.cfg.branch)}`;
  }

  async readText(path: string, ref?: string): Promise<string | null> {
    assertReadablePath(path);
    const res = await this.request(this.contentsPath(path, ref), { accept: "application/vnd.github.raw+json" });
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res, `ler ${path}`);
    return res.text();
  }

  async readBinary(path: string, ref?: string): Promise<Uint8Array | null> {
    assertReadablePath(path);
    const res = await this.request(this.contentsPath(path, ref), { accept: "application/vnd.github.raw+json" });
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res, `ler ${path}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async listFiles(prefix: string, ref?: string): Promise<ListedFile[]> {
    const sha = ref || (await this.head());
    const commit = await this.getJson<{ tree: { sha: string } }>(`/git/commits/${sha}`, "ler o commit atual");
    const tree = await this.getJson<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
      `/git/trees/${commit.tree.sha}?recursive=1`,
      "listar arquivos",
    );
    if (tree.truncated) throw new StorageError("O repositório é grande demais para listar de uma vez.", 502);
    return tree.tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix)).map((e) => ({ path: e.path, size: e.size ?? 0 }));
  }

  async commit(files: RepoFile[], message: string, parent?: string): Promise<CommitResult> {
    if (files.length === 0) throw new StorageError("Nada para gravar.", 400);
    files.forEach((f) => assertWritablePath(f.path));

    const parentSha = parent || (await this.head());
    const parentCommit = await this.getJson<{ tree: { sha: string } }>(`/git/commits/${parentSha}`, "ler o commit atual");

    const entries: { path: string; mode: string; type: string; sha: string | null }[] = [];
    for (const f of files) {
      if (f.content === null) {
        entries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const buf = typeof f.content === "string" ? Buffer.from(f.content, "utf8") : Buffer.from(f.content);
      const blob = await this.postJson<{ sha: string }>(
        "/git/blobs",
        { content: buf.toString("base64"), encoding: "base64" },
        `enviar ${f.path}`,
      );
      entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const tree = await this.postJson<{ sha: string }>(
      "/git/trees",
      { base_tree: parentCommit.tree.sha, tree: entries },
      "montar a árvore de arquivos",
    );
    const commit = await this.postJson<{ sha: string; html_url?: string }>(
      "/git/commits",
      { message, tree: tree.sha, parents: [parentSha] },
      "criar o commit",
    );

    const res = await this.request(`/git/refs/heads/${encodeURIComponent(this.cfg.branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (res.status === 422 || res.status === 409) throw new HeadMovedError();
    if (!res.ok) await this.fail(res, `atualizar o ramo ${this.cfg.branch}`);
    return { commit: commit.sha, url: commit.html_url };
  }

  /**
   * Estado do deploy informado pelo Vercel ao GitHub (Deployments e Commit Statuses).
   * Requer permissão de leitura de "Deployments" e "Commit statuses" no token.
   */
  async deployStatus(sha: string): Promise<DeployStatus> {
    try {
      const deps = await this.request(`/deployments?sha=${sha}&per_page=5`);
      if (deps.ok) {
        const list = (await deps.json()) as { id: number; environment: string }[];
        const prod = list.find((d) => /production/i.test(d.environment)) || list[0];
        if (prod) {
          const st = await this.request(`/deployments/${prod.id}/statuses?per_page=1`);
          if (st.ok) {
            const [last] = (await st.json()) as {
              state: string;
              description?: string;
              log_url?: string;
              target_url?: string;
              environment_url?: string;
            }[];
            if (last) {
              const state: DeployStatus["state"] =
                last.state === "success" ? "success" : last.state === "failure" || last.state === "error" ? "failure" : "pending";
              return {
                state,
                description: last.description,
                targetUrl: last.log_url || last.target_url,
                environmentUrl: last.environment_url,
              };
            }
            return { state: "pending", description: "Deploy registrado, aguardando início." };
          }
        }
      }
      const statusRes = await this.request(`/commits/${sha}/status`);
      if (statusRes.ok) {
        const combined = (await statusRes.json()) as {
          statuses: { context: string; state: string; description?: string; target_url?: string }[];
        };
        const vercel = combined.statuses.find((s) => /vercel/i.test(s.context));
        if (vercel) {
          const state: DeployStatus["state"] =
            vercel.state === "success" ? "success" : vercel.state === "failure" || vercel.state === "error" ? "failure" : "pending";
          return { state, description: vercel.description, targetUrl: vercel.target_url };
        }
      }
    } catch {
      /* status é informativo; a confirmação real vem de /api/version */
    }
    return { state: "unknown" };
  }
}
