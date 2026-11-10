import { requireAdmin } from "@/lib/server/auth";
import { loadDraft } from "@/lib/server/content";
import { json, withErrors } from "@/lib/server/http";
import { getStorage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** Arquivos em public/media sem cadastro no rascunho (ex.: envio concluído, mas rascunho não salvo). */
export const GET = withErrors(async (request: Request) => {
  await requireAdmin(request);
  const storage = getStorage();
  const { draft, head } = await loadDraft(storage);
  const known = new Set(draft.media.map((m) => `public/${m.path}`));
  const files = await storage.listFiles("public/media/", head);
  const orphans = files
    .filter((f) => !known.has(f.path) && /\.(webp|jpe?g|png|avif|mp4|webm)$/i.test(f.path))
    .map((f) => ({ path: f.path.replace(/^public\//, ""), size: f.size }));
  return json({ orphans });
});
