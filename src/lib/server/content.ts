import "server-only";
import { describeIssues, safeParseStore, type Store } from "../schema";
import { hasErrors, validateStore } from "../validate";
import { HttpError } from "./http";
import { getStorage, HeadMovedError, type ContentStorage } from "./storage";

export const DRAFT_PATH = "data/draft.json";
export const STORE_PATH = "data/store.json";

function parseOrThrow(raw: string, label: string): Store {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HttpError(500, `O arquivo ${label} está corrompido (JSON inválido).`, "corrupt-data");
  }
  const parsed = safeParseStore(json);
  if (!parsed.success) {
    throw new HttpError(500, `O arquivo ${label} não segue o formato esperado.`, "invalid-data", parsed.error.issues.slice(0, 10));
  }
  return parsed.data;
}

/** Valida o documento enviado pelo painel. */
export function parseIncoming(input: unknown): Store {
  const parsed = safeParseStore(input);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "Os dados enviados contêm campos inválidos.",
      "invalid-input",
      describeIssues(input, parsed.error.issues).map((message) => ({ message })),
    );
  }
  return parsed.data;
}

export interface LoadedDraft {
  draft: Store;
  head: string;
  source: "draft" | "store";
}

export async function loadDraft(storage: ContentStorage = getStorage()): Promise<LoadedDraft> {
  const head = await storage.head();
  const draftRaw = await storage.readText(DRAFT_PATH, head);
  if (draftRaw !== null) return { draft: parseOrThrow(draftRaw, DRAFT_PATH), head, source: "draft" };
  const storeRaw = await storage.readText(STORE_PATH, head);
  if (storeRaw === null) throw new HttpError(500, "Nenhum arquivo de conteúdo encontrado no repositório.", "no-data");
  return { draft: parseOrThrow(storeRaw, STORE_PATH), head, source: "store" };
}

export async function loadRemotePublished(storage: ContentStorage = getStorage(), ref?: string): Promise<Store | null> {
  const raw = await storage.readText(STORE_PATH, ref);
  return raw === null ? null : parseOrThrow(raw, STORE_PATH);
}

function conflict(current: Store): HttpError {
  return new HttpError(
    409,
    "O rascunho foi alterado por outra sessão desde que você o abriu. Recarregue para ver a versão mais recente antes de salvar.",
    "conflict",
    { revision: current.meta.revision, updatedAt: current.meta.updatedAt },
  );
}

const stringify = (s: Store) => JSON.stringify(s, null, 2) + "\n";

/** Tenta novamente quando outro commit (ex.: upload) avançou o ramo durante a gravação. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof HeadMovedError)) throw e;
      last = e;
    }
  }
  throw new HttpError(409, "O repositório recebeu outras gravações simultâneas. Tente novamente.", "busy", String(last));
}

export async function saveDraft(incoming: unknown, baseRevision: number, actor: string) {
  const storage = getStorage();
  const draft = parseIncoming(incoming);
  return withRetry(async () => {
    const { draft: current, head } = await loadDraft(storage);
    if (current.meta.revision !== baseRevision) throw conflict(current);
    const now = new Date().toISOString();
    const next: Store = { ...draft, meta: { ...draft.meta, revision: baseRevision + 1, updatedAt: now } };
    const result = await storage.commit(
      [{ path: DRAFT_PATH, content: stringify(next) }],
      `Prime TV: rascunho salvo por ${actor} (rev. ${next.meta.revision})`,
      head,
    );
    return { revision: next.meta.revision, updatedAt: now, commit: result.commit, commitUrl: result.url };
  });
}

function makeVersion(date: Date, revision: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(
    date.getUTCMinutes(),
  )}${p(date.getUTCSeconds())}-r${revision}`;
}

/** Mídias do repositório que a versão publicada precisa ter disponíveis. */
function requiredMediaPaths(store: Store): string[] {
  const used = new Set<string>();
  for (const s of store.slides) {
    const d = s.data as Record<string, unknown>;
    for (const key of ["mediaId", "composedMediaId", "beforeMediaId", "afterMediaId", "posterMediaId"]) {
      if (typeof d[key] === "string") used.add(d[key] as string);
    }
  }
  if (store.settings.fallback.mediaId) used.add(store.settings.fallback.mediaId);
  if (store.settings.logoLightMediaId) used.add(store.settings.logoLightMediaId);
  if (store.settings.logoDarkMediaId) used.add(store.settings.logoDarkMediaId);
  return store.media.filter((m) => m.storage === "repo" && used.has(m.id)).map((m) => `public/${m.path}`);
}

export async function publish(incoming: unknown, baseRevision: number, actor: string) {
  const storage = getStorage();
  const draft = parseIncoming(incoming);

  const issues = validateStore(draft);
  if (hasErrors(issues)) {
    throw new HttpError(422, "A publicação foi bloqueada por erros de validação.", "validation", issues);
  }

  return withRetry(async () => {
    const { draft: current, head } = await loadDraft(storage);
    if (current.meta.revision !== baseRevision) throw conflict(current);

    // Confirma que todas as mídias usadas já estão armazenadas no repositório.
    const files = new Set((await storage.listFiles("public/media/", head)).map((f) => f.path));
    const missing = requiredMediaPaths(draft).filter((p) => !files.has(p));
    if (missing.length) {
      throw new HttpError(422, `Mídias ausentes no repositório: ${missing.join(", ")}`, "missing-media", missing);
    }

    const now = new Date();
    const revision = baseRevision + 1;
    const version = makeVersion(now, revision);
    const at = now.toISOString();
    const published: Store = {
      ...draft,
      meta: { revision, version, updatedAt: at, publishedAt: at },
    };
    const nextDraft: Store = { ...published, meta: { ...published.meta, lastPublish: { version, at, by: actor, revision } } };

    const result = await storage.commit(
      [
        { path: STORE_PATH, content: stringify(published) },
        { path: DRAFT_PATH, content: stringify(nextDraft) },
      ],
      `Prime TV: publicação ${version} por ${actor}`,
      head,
    );
    return { revision, version, publishedAt: at, commit: result.commit, commitUrl: result.url, warnings: issues };
  });
}
