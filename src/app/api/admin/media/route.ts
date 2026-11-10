import { requireAdmin } from "@/lib/server/auth";
import { loadDraft, loadRemotePublished } from "@/lib/server/content";
import { HttpError, json, withErrors } from "@/lib/server/http";
import { getStorage, type RepoFile } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * Exclusão definitiva de arquivos de mídia do repositório.
 * Só é permitida quando nenhum cadastro (rascunho ou versão publicada) usa o arquivo.
 * Observação: o histórico do Git mantém versões antigas; ver README para remoção completa.
 */
export const DELETE = withErrors(async (request: Request) => {
  const session = await requireAdmin(request);
  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Requisição inválida.");
  }
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  if (paths.length === 0 || paths.length > 50) throw new HttpError(400, "Informe de 1 a 50 arquivos.");
  for (const p of paths) {
    if (!/^(media\/|archive\/originals\/)[a-z0-9][a-z0-9_/.-]*$/i.test(p) || p.includes(".."))
      throw new HttpError(400, `Caminho inválido: ${p}`);
  }

  const storage = getStorage();
  const { draft, head } = await loadDraft(storage);
  const published = await loadRemotePublished(storage, head);
  const referenced = new Set<string>();
  for (const store of [draft, published]) {
    if (!store) continue;
    for (const m of store.media) {
      referenced.add(m.path);
      if (m.originalPath) referenced.add(m.originalPath);
    }
  }
  const blocked = paths.filter((p) => referenced.has(p));
  if (blocked.length) {
    throw new HttpError(
      409,
      "Arquivo ainda cadastrado no rascunho ou na versão publicada. Remova o cadastro, salve/publique e tente novamente.",
      "in-use",
      blocked,
    );
  }

  const existing = new Set([
    ...(await storage.listFiles("public/media/", head)).map((f) => f.path),
    ...(await storage.listFiles("archive/originals/", head)).map((f) => f.path),
  ]);
  const files: RepoFile[] = paths
    .map((p) => (p.startsWith("media/") ? `public/${p}` : p))
    .filter((p) => existing.has(p))
    .map((p) => ({ path: p, content: null }));
  if (files.length === 0) return json({ deleted: 0 });

  const result = await storage.commit(files, `Prime TV: exclusão de ${files.length} arquivo(s) por ${session.user}`, head);
  return json({ deleted: files.length, commit: result.commit });
});
