"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { publicMediaUrl } from "@/lib/manifest";
import { describeIssues, safeParseStore, type Media, type Store } from "@/lib/schema";
import { api, ApiError, jsonInit } from "@/lib/client/api";
import { batchUploads, buildForm, type PreparedUpload, type UploadedFile } from "@/lib/client/upload";
import { newId } from "@/lib/slide-meta";
import { hasErrors, validateStore, type Issue } from "@/lib/validate";
import { useFeedback } from "./ui";

/**
 * Estado do rascunho no painel. Toda edição acontece localmente e só vai para o GitHub
 * em "Salvar rascunho" (draft.json) ou "Publicar alterações" (store.json + draft.json).
 */

export interface StorageInfo {
  kind: "github" | "local";
  repo?: string;
  branch?: string;
  commitUrlBase?: string;
}

export interface DeployedInfo {
  version: string;
  publishedAt?: string;
  commit: string | null;
  builtAt: string;
}

export type PublishPhase = "deploying" | "published" | "error" | "timeout";

export interface PublishState {
  version: string;
  commit?: string;
  commitUrl?: string;
  phase: PublishPhase;
  message?: string;
  targetUrl?: string;
  startedAt: number;
}

export type DraftStatus = "loading" | "dirty" | "saving" | "saved" | "publishing" | "deploying" | "published" | "error";

export interface MediaMeta {
  name?: string;
  category: Media["category"];
  procedure?: string;
  tags?: string[];
  hasText: boolean;
  clinical: boolean;
}

interface DraftContextValue {
  draft: Store;
  user: string;
  storage: StorageInfo;
  deployed: DeployedInfo;
  dirty: boolean;
  status: DraftStatus;
  statusLabel: string;
  publishState: PublishState | null;
  busy: boolean;
  issues: Issue[];
  unpublished: boolean;
  update: (recipe: (draft: Store) => void) => void;
  save: (opts?: { silent?: boolean }) => Promise<boolean>;
  publish: () => Promise<void>;
  reload: () => Promise<void>;
  uploadMedia: (items: PreparedUpload[], meta: MediaMeta, onProgress?: (done: number, total: number) => void) => Promise<Media[]>;
  mediaUrl: (m: Media) => string;
  mediaById: Map<string, Media>;
}

const DraftContext = createContext<DraftContextValue | null>(null);
const BACKUP_KEY = "primetv:admin:backup";
const COMMIT_KEY = "primetv:admin:last-commit";
const POLL_MS = 5000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

interface Loaded {
  user: string;
  draft: Store;
  storage: StorageInfo;
  deployed: DeployedInfo;
  deployedMedia: string[] | null;
}

export function DraftProvider({ children }: { children: ReactNode }) {
  const { toast, confirm } = useFeedback();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Store | null>(null);
  const [dirty, setDirty] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "publishing">("idle");
  const [publishState, setPublishState] = useState<PublishState | null>(null);
  const baseRevision = useRef(0);
  const editCounter = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Store | null>(null);
  const dirtyRef = useRef(false);
  useLayoutEffect(() => {
    draftRef.current = draft;
    dirtyRef.current = dirty;
  });

  const pollStatus = useCallback(
    (version: string, commit: string | undefined, startedAt: number) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      const tick = async () => {
        try {
          const res = await api<{ state: string; message?: string; targetUrl?: string; liveVersion: string }>(
            `/api/admin/publish/status?version=${encodeURIComponent(version)}${commit ? `&commit=${commit}` : ""}`,
          );
          if (res.state === "published") {
            setPublishState((p) => ({
              ...(p ?? { version, startedAt }),
              version,
              commit,
              phase: "published",
              message: "Nova versão no ar.",
            }));
            setLoaded((l) => (l ? { ...l, deployed: { ...l.deployed, version } } : l));
            toast("Publicação concluída. As TVs adotam a nova programação na próxima verificação (até ~1 minuto).");
            return;
          }
          if (res.state === "error") {
            setPublishState((p) => ({
              ...(p ?? { version, startedAt }),
              version,
              commit,
              phase: "error",
              message: res.message,
              targetUrl: res.targetUrl,
            }));
            toast(`Erro de publicação: ${res.message ?? "o deploy falhou."}`, "error");
            return;
          }
          setPublishState((p) => ({
            ...(p ?? { version, startedAt }),
            version,
            commit,
            phase: "deploying",
            message: res.message,
            targetUrl: res.targetUrl,
          }));
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) return;
        }
        if (Date.now() - startedAt > POLL_LIMIT_MS) {
          setPublishState((p) =>
            p ? { ...p, phase: "timeout", message: "O deploy está demorando mais que o normal. Verifique o painel do Vercel." } : p,
          );
          return;
        }
        pollTimer.current = setTimeout(tick, POLL_MS);
      };
      void tick();
    },
    [toast],
  );

  /** Aplica o conteúdo carregado do servidor (inclui a recuperação de edições locais). */
  const applyLoaded = useCallback(
    async (res: Loaded) => {
      {
        baseRevision.current = res.draft.meta.revision;
        let initial = res.draft;
        let restoredDirty = false;
        try {
          const raw = localStorage.getItem(BACKUP_KEY);
          if (raw) {
            const backup = JSON.parse(raw) as { baseRevision: number; draft: Store; savedAt: string };
            if (backup.baseRevision === res.draft.meta.revision && JSON.stringify(backup.draft) !== JSON.stringify(res.draft)) {
              const ok = await confirm({
                title: "Recuperar alterações não salvas?",
                message: `Encontramos edições feitas neste navegador em ${new Date(backup.savedAt).toLocaleString("pt-BR")} que não foram salvas. Deseja recuperá-las?`,
                confirmLabel: "Recuperar",
              });
              if (ok) {
                initial = backup.draft;
                restoredDirty = true;
              } else localStorage.removeItem(BACKUP_KEY);
            } else if (backup.baseRevision !== res.draft.meta.revision) {
              localStorage.removeItem(BACKUP_KEY);
            }
          }
        } catch {
          /* backup ilegível: ignora */
        }
        setLoaded(res);
        setDraft(initial);
        setDirty(restoredDirty);

        // Publicação anterior ainda sem deploy confirmado: retoma o acompanhamento.
        const last = res.draft.meta.lastPublish;
        if (last && last.version !== res.deployed.version && res.storage.kind === "github") {
          let commit: string | undefined;
          try {
            const saved = JSON.parse(localStorage.getItem(COMMIT_KEY) || "null") as { version: string; commit: string } | null;
            if (saved?.version === last.version) commit = saved.commit;
          } catch {
            /* ignore */
          }
          const startedAt = Date.parse(last.at) || Date.now();
          setPublishState({ version: last.version, commit, phase: "deploying", startedAt });
          pollStatus(last.version, commit, Math.max(startedAt, Date.now() - POLL_LIMIT_MS / 2));
        }
      }
    },
    [confirm, pollStatus],
  );

  const fail = useCallback((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)), []);
  const load = useCallback(() => api<Loaded>("/api/admin/draft").then(applyLoaded).catch(fail), [applyLoaded, fail]);

  useEffect(() => {
    api<Loaded>("/api/admin/draft").then(applyLoaded).catch(fail);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [applyLoaded, fail]);

  // Cópia de segurança local das edições não salvas.
  useEffect(() => {
    if (!dirty || !draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ baseRevision: baseRevision.current, draft, savedAt: new Date().toISOString() }));
      } catch {
        /* sem espaço: ignora */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const update = useCallback((recipe: (d: Store) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      recipe(next);
      return next;
    });
    editCounter.current++;
    setDirty(true);
  }, []);

  const applyMeta = (meta: Partial<Store["meta"]>) => setDraft((prev) => (prev ? { ...prev, meta: { ...prev.meta, ...meta } } : prev));

  const handleConflict = useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && e.code === "conflict") {
        const ok = await confirm({
          title: "Rascunho alterado em outra sessão",
          message:
            "Outra pessoa (ou outra aba) salvou o rascunho depois que você o abriu. Para não sobrescrever o trabalho, recarregue a versão mais recente. Suas edições locais ficam guardadas neste navegador e poderão ser recuperadas manualmente.",
          confirmLabel: "Recarregar agora",
        });
        if (ok) {
          localStorage.removeItem(BACKUP_KEY);
          setDirty(false);
          await load();
        }
        return true;
      }
      return false;
    },
    [confirm, load],
  );

  const persist = useCallback(
    async (current: Store, opts: { silent?: boolean } = {}) => {
      const check = safeParseStore(current);
      if (!check.success) {
        toast(
          <div>
            <p className="font-medium">Revise os campos antes de salvar:</p>
            <ul className="mt-1 list-disc pl-5 text-[13px]">
              {describeIssues(current, check.error.issues).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>,
          "error",
        );
        return false;
      }
      const counterAtStart = editCounter.current;
      setPhase("saving");
      try {
        const res = await api<{ revision: number; updatedAt: string }>(
          "/api/admin/draft",
          jsonInit("PUT", { draft: current, baseRevision: baseRevision.current }),
        );
        baseRevision.current = res.revision;
        applyMeta({ revision: res.revision, updatedAt: res.updatedAt });
        if (editCounter.current === counterAtStart) {
          setDirty(false);
          localStorage.removeItem(BACKUP_KEY);
        }
        if (!opts.silent) toast("Rascunho salvo. A TV continua exibindo a versão publicada.");
        return true;
      } catch (e) {
        if (!(await handleConflict(e))) toast(`Não foi possível salvar: ${e instanceof Error ? e.message : e}`, "error");
        return false;
      } finally {
        setPhase("idle");
      }
    },
    [toast, handleConflict],
  );

  const save = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const current = draftRef.current;
      if (!current) return false;
      if (!dirtyRef.current) return true;
      return persist(current, opts);
    },
    [persist],
  );

  const publish = useCallback(async () => {
    const current = draftRef.current;
    if (!current || !loaded) return;
    const parsed = safeParseStore(current);
    if (!parsed.success) {
      toast(`Revise os campos antes de publicar: ${describeIssues(current, parsed.error.issues).join(" · ")}`, "error");
      return;
    }
    const issues = validateStore(current);
    if (hasErrors(issues)) {
      toast(`Corrija ${issues.filter((i) => i.level === "error").length} erro(s) antes de publicar (veja o painel inicial).`, "error");
      return;
    }
    const warnings = issues.filter((i) => i.level === "warning");
    const ok = await confirm({
      title: "Publicar alterações?",
      confirmLabel: "Publicar",
      message: (
        <div className="space-y-3">
          <p>
            A programação será gravada no repositório e{" "}
            {loaded.storage.kind === "github"
              ? "o Vercel fará um novo deploy (normalmente 1 a 3 minutos)"
              : "aplicada imediatamente (modo local)"}
            . As TVs continuam exibindo a versão atual até a nova estar pronta.
          </p>
          {warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">{warnings.length} aviso(s):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                {warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
                {warnings.length > 6 && <li>… e mais {warnings.length - 6}.</li>}
              </ul>
            </div>
          )}
        </div>
      ),
    });
    if (!ok) return;
    const counterAtStart = editCounter.current;
    setPhase("publishing");
    try {
      const res = await api<{ revision: number; version: string; publishedAt: string; commit: string; commitUrl?: string; mode: string }>(
        "/api/admin/publish",
        jsonInit("POST", { draft: current, baseRevision: baseRevision.current }),
      );
      baseRevision.current = res.revision;
      applyMeta({
        revision: res.revision,
        version: res.version,
        updatedAt: res.publishedAt,
        publishedAt: res.publishedAt,
        lastPublish: { version: res.version, at: res.publishedAt, by: loaded.user, revision: res.revision },
      });
      if (editCounter.current === counterAtStart) {
        setDirty(false);
        localStorage.removeItem(BACKUP_KEY);
      }
      try {
        localStorage.setItem(COMMIT_KEY, JSON.stringify({ version: res.version, commit: res.commit }));
      } catch {
        /* ignore */
      }
      const startedAt = Date.now();
      setPublishState({
        version: res.version,
        commit: res.commit,
        commitUrl: res.commitUrl,
        phase: "deploying",
        startedAt,
        message: "Arquivos gravados. Aguardando o deploy.",
      });
      pollStatus(res.version, res.commit, startedAt);
    } catch (e) {
      if (await handleConflict(e)) return;
      const details =
        e instanceof ApiError && Array.isArray(e.details)
          ? (e.details as { message?: string }[]).map((d) => d.message).filter(Boolean)
          : [];
      setPublishState({ version: "", phase: "error", startedAt: Date.now(), message: e instanceof Error ? e.message : String(e) });
      toast(
        <div>
          <p className="font-medium">Erro de publicação: {e instanceof Error ? e.message : String(e)}</p>
          {details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[13px]">
              {details.slice(0, 4).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>,
        "error",
      );
    } finally {
      setPhase("idle");
    }
  }, [loaded, confirm, toast, pollStatus, handleConflict]);

  const deployedSet = useMemo(() => (loaded?.deployedMedia ? new Set(loaded.deployedMedia) : null), [loaded]);

  const mediaUrl = useCallback(
    (m: Media) => {
      if (m.storage === "r2") return publicMediaUrl(m);
      if (!deployedSet || deployedSet.has(m.path)) return `/${m.path}`;
      // Enviada após o último deploy: exibida pela rota autenticada até a publicação.
      return `/api/admin/media-file/${m.path}`;
    },
    [deployedSet],
  );

  const uploadMedia = useCallback(
    async (items: PreparedUpload[], meta: MediaMeta, onProgress?: (done: number, total: number) => void) => {
      const created: Media[] = [];
      const batches = batchUploads(items);
      let done = 0;
      onProgress?.(0, items.length);
      try {
        for (const batch of batches) {
          const res = await api<{ files: UploadedFile[] }>("/api/admin/upload", { method: "POST", body: buildForm(batch) });
          const now = new Date().toISOString();
          for (const f of res.files) {
            const src = batch.find((b) => b.clientId === f.clientId);
            if (!src) continue;
            created.push({
              id: newId("med"),
              kind: f.kind,
              storage: "repo",
              path: f.path,
              originalPath: f.originalPath,
              name: meta.name && items.length === 1 ? meta.name : src.baseName.replace(/[-_]+/g, " "),
              category: meta.category,
              procedure: meta.procedure || undefined,
              tags: meta.tags ?? [],
              width: src.width,
              height: src.height,
              bytes: f.bytes,
              mime: f.mime,
              durationSec: src.durationSec,
              hasText: meta.hasText,
              focalX: 50,
              focalY: 50,
              status: "active",
              clinical: { isClinical: meta.clinical, consent: "pending" },
              createdAt: now,
              updatedAt: now,
            });
          }
          done += batch.length;
          onProgress?.(done, items.length);
        }
      } finally {
        // Cataloga o que foi enviado (mesmo se um lote posterior falhar) e salva o rascunho.
        if (created.length && draftRef.current) {
          const next = structuredClone(draftRef.current);
          next.media.unshift(...created);
          draftRef.current = next;
          setDraft(next);
          editCounter.current++;
          setDirty(true);
          await persist(next, { silent: true });
        }
      }
      return created;
    },
    [persist],
  );

  const issues = useMemo(() => (draft ? validateStore(draft) : []), [draft]);
  const mediaById = useMemo(() => new Map((draft?.media ?? []).map((m) => [m.id, m])), [draft]);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-red-800">Não foi possível carregar o conteúdo</h1>
          <p className="mt-2 text-sm leading-relaxed text-sand-700">{loadError}</p>
          <p className="mt-3 text-[13px] text-sand-500">
            Confira as variáveis de ambiente (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH) e se o repositório contém
            data/store.json.
          </p>
          <button
            className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white"
            onClick={() => (setLoadError(null), void load())}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!loaded || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-sand-500">
        <span className="animate-pulse">Carregando conteúdo…</span>
      </div>
    );
  }

  const unpublished = dirty || draft.meta.revision !== draft.meta.lastPublish?.revision;
  let status: DraftStatus;
  let statusLabel: string;
  if (phase === "saving") [status, statusLabel] = ["saving", "Salvando…"];
  else if (phase === "publishing") [status, statusLabel] = ["publishing", "Publicando…"];
  else if (dirty) [status, statusLabel] = ["dirty", "Rascunho com alterações não salvas"];
  else if (publishState?.phase === "deploying") [status, statusLabel] = ["deploying", "Publicando — aguardando deploy"];
  else if (publishState?.phase === "error" || publishState?.phase === "timeout") [status, statusLabel] = ["error", "Erro de publicação"];
  else if (unpublished) [status, statusLabel] = ["saved", "Rascunho salvo · não publicado"];
  else if (draft.meta.lastPublish?.version === loaded.deployed.version || loaded.storage.kind === "local")
    [status, statusLabel] = ["published", "Publicado"];
  else [status, statusLabel] = ["deploying", "Publicação aguardando deploy"];

  const value: DraftContextValue = {
    draft,
    user: loaded.user,
    storage: loaded.storage,
    deployed: loaded.deployed,
    dirty,
    status,
    statusLabel,
    publishState,
    busy: phase !== "idle",
    issues,
    unpublished,
    update,
    save,
    publish,
    reload: load,
    uploadMedia,
    mediaUrl,
    mediaById,
  };

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("DraftProvider ausente");
  return ctx;
}
