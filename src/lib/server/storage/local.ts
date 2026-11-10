import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertReadablePath,
  assertWritablePath,
  type CommitResult,
  type ContentStorage,
  type DeployStatus,
  type ListedFile,
  type RepoFile,
} from "./types";

/**
 * Driver de desenvolvimento: grava diretamente no projeto local.
 * Não use em produção no Vercel (o sistema de arquivos de execução não é persistente).
 */
export class LocalStorage implements ContentStorage {
  readonly kind = "local" as const;
  private queue: Promise<unknown> = Promise.resolve();
  private counter = 0;

  constructor(private root: string) {}

  describe() {
    return { kind: this.kind };
  }

  private abs(p: string) {
    const full = path.resolve(this.root, p);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Caminho inválido.");
    return full;
  }

  async head(): Promise<string> {
    try {
      const st = await fs.stat(this.abs("data/draft.json"));
      return `local-${st.mtimeMs.toFixed(0)}`;
    } catch {
      return "local-0";
    }
  }

  async readText(p: string): Promise<string | null> {
    assertReadablePath(p);
    try {
      return await fs.readFile(this.abs(p), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async readBinary(p: string): Promise<Uint8Array | null> {
    assertReadablePath(p);
    try {
      return new Uint8Array(await fs.readFile(this.abs(p)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async listFiles(prefix: string): Promise<ListedFile[]> {
    const out: ListedFile[] = [];
    const walk = async (rel: string) => {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(this.abs(rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const child = `${rel}/${e.name}`;
        if (e.isDirectory()) await walk(child);
        else if (e.isFile()) out.push({ path: child, size: (await fs.stat(this.abs(child))).size });
      }
    };
    await walk(prefix.replace(/\/$/, ""));
    return out;
  }

  async commit(files: RepoFile[], message: string, parent?: string): Promise<CommitResult> {
    files.forEach((f) => assertWritablePath(f.path));
    // Fila simples: garante gravações sequenciais dentro do processo.
    const run = async () => {
      if (parent && parent !== (await this.head())) {
        const { HeadMovedError } = await import("./types");
        throw new HeadMovedError();
      }
      for (const f of files) {
        const target = this.abs(f.path);
        if (f.content === null) {
          await fs.rm(target, { force: true });
          continue;
        }
        await fs.mkdir(path.dirname(target), { recursive: true });
        const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
        await fs.writeFile(tmp, typeof f.content === "string" ? f.content : Buffer.from(f.content));
        await fs.rename(tmp, target);
      }
      this.counter++;
      return { commit: `local-${Date.now()}-${this.counter}`, message } as CommitResult;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async deployStatus(): Promise<DeployStatus> {
    return { state: "success", description: "Modo local: alterações aplicadas imediatamente." };
  }
}
