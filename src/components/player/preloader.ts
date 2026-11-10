/**
 * Pré-carregamento de mídias com limite de memória.
 * Mantém decodificadas apenas as próximas imagens; falhas expiram para novas tentativas.
 */

export interface PreloadItem {
  url: string;
  kind: "image" | "video";
}

interface Entry {
  promise: Promise<boolean>;
  ok?: boolean;
  at: number;
}

const FAILURE_TTL_MS = 60_000;
const MAX_ENTRIES = 60;
const MAX_HELD = 8;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

export class Preloader {
  private entries = new Map<string, Entry>();
  private held: HTMLImageElement[] = [];

  private loadImage(url: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (ok) {
          this.held.push(img);
          if (this.held.length > MAX_HELD) this.held.splice(0, this.held.length - MAX_HELD);
        }
        resolve(ok);
      };
      img.onload = () => {
        if (typeof img.decode === "function")
          img.decode().then(
            () => done(true),
            () => done(img.naturalWidth > 0),
          );
        else done(true);
      };
      img.onerror = () => done(false);
      img.src = url;
    });
  }

  private loadVideo(url: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        v.removeAttribute("src");
        try {
          v.load();
        } catch {
          /* ignore */
        }
        resolve(ok);
      };
      v.onloadeddata = () => done(true);
      v.oncanplay = () => done(true);
      v.onerror = () => done(false);
      v.src = url;
    });
  }

  load(item: PreloadItem, timeoutMs = 15_000): Promise<boolean> {
    const now = Date.now();
    const existing = this.entries.get(item.url);
    if (existing && (existing.ok !== false || now - existing.at < FAILURE_TTL_MS)) {
      // reordena (LRU)
      this.entries.delete(item.url);
      this.entries.set(item.url, existing);
      return existing.promise;
    }
    const raw = item.kind === "video" ? this.loadVideo(item.url) : this.loadImage(item.url);
    const entry: Entry = { promise: withTimeout(raw, timeoutMs, false), at: now };
    entry.promise.then((ok) => {
      entry.ok = ok;
      entry.at = Date.now();
      // Tempo esgotado não é falha definitiva: permite nova tentativa logo.
      if (!ok) entry.at = Date.now() - FAILURE_TTL_MS / 2;
    });
    this.entries.set(item.url, entry);
    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
    return entry.promise;
  }

  async ensure(items: PreloadItem[], timeoutMs = 15_000): Promise<boolean> {
    if (items.length === 0) return true;
    const results = await Promise.all(items.map((i) => this.load(i, timeoutMs)));
    return results.every(Boolean);
  }

  /** Aquece o cache HTTP/Service Worker sem decodificar (para novas versões). */
  async warm(urls: string[], timeoutMs = 30_000): Promise<boolean> {
    const results = await Promise.all(
      urls.map((url) =>
        withTimeout(
          // O corpo precisa ser lido por completo para ficar no cache.
          fetch(url, { cache: "default", credentials: "same-origin" }).then((r) => (r.ok ? r.arrayBuffer().then(() => true) : false)),
          timeoutMs,
          false,
        ),
      ),
    );
    return results.every(Boolean);
  }
}
