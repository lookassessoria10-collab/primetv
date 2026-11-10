import { requireAdmin } from "@/lib/server/auth";
import { loadDraft, saveDraft } from "@/lib/server/content";
import { env } from "@/lib/server/env";
import { HttpError, json, withErrors } from "@/lib/server/http";
import { getBuildInfo, getPublishedStore } from "@/lib/server/published";
import { getStorage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** Rascunho atual (lido do GitHub a cada abertura do painel) e informações do deploy em execução. */
export const GET = withErrors(async (request: Request) => {
  const session = await requireAdmin(request);
  const storage = getStorage();
  const { draft, source } = await loadDraft(storage);
  const deployed = getPublishedStore();
  const build = getBuildInfo();
  return json({
    user: session.user,
    draft,
    source,
    storage: storage.describe(),
    deployed: {
      version: deployed.meta.version,
      publishedAt: deployed.meta.publishedAt,
      commit: env.commitSha || build.commit || null,
      builtAt: build.builtAt,
    },
    deployedMedia: build.mediaFiles,
  });
});

export const PUT = withErrors(async (request: Request) => {
  const session = await requireAdmin(request);
  let body: { draft?: unknown; baseRevision?: unknown };
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Requisição inválida.");
  }
  if (typeof body.baseRevision !== "number") throw new HttpError(400, "Revisão de base ausente.");
  const result = await saveDraft(body.draft, body.baseRevision, session.user);
  return json(result);
});
