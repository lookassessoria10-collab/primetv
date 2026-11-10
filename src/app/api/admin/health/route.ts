import { requireAdmin } from "@/lib/server/auth";
import { loadDraft } from "@/lib/server/content";
import { env, missingAuthConfig, missingStorageConfig } from "@/lib/server/env";
import { json, withErrors } from "@/lib/server/http";
import { getStorage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** Diagnóstico da configuração: variáveis, acesso ao repositório e leitura do rascunho. */
export const GET = withErrors(async (request: Request) => {
  await requireAdmin(request);
  const checks: { label: string; ok: boolean; detail?: string }[] = [];
  checks.push({
    label: "Variáveis de autenticação",
    ok: missingAuthConfig().length === 0,
    detail: missingAuthConfig().join(", ") || undefined,
  });
  checks.push({
    label: `Armazenamento (${env.storageDriver})`,
    ok: env.storageDriver !== "none" && missingStorageConfig().length === 0,
    detail:
      env.storageDriver === "local"
        ? "Modo local: grava no disco (apenas desenvolvimento)."
        : missingStorageConfig().join(", ") || undefined,
  });
  try {
    const storage = getStorage();
    const head = await storage.head();
    checks.push({
      label: "Acesso ao repositório",
      ok: true,
      detail: storage.kind === "github" ? `Commit atual ${head.slice(0, 7)}` : head,
    });
    const { draft, source } = await loadDraft(storage);
    checks.push({
      label: "Leitura do conteúdo",
      ok: true,
      detail: `${source === "draft" ? "Rascunho" : "Versão publicada"} rev. ${draft.meta.revision}`,
    });
  } catch (e) {
    checks.push({ label: "Acesso ao repositório", ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  checks.push({ label: "APP_URL", ok: Boolean(env.appUrl), detail: env.appUrl || "Opcional: usada para gerar os links das TVs." });
  return json({ checks });
});
