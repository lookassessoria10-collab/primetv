import { buildUnitManifest, findUnitByCode } from "@/lib/manifest";
import { json, withErrors } from "@/lib/server/http";
import { getPublishedStore } from "@/lib/server/published";

export const dynamic = "force-dynamic";

/** Manifesto público de reprodução de uma unidade (somente a versão publicada). */
export const GET = withErrors(async (_request: Request, ctx: { params: Promise<{ unit: string }> }) => {
  const { unit: code } = await ctx.params;
  const store = getPublishedStore();
  const unit = findUnitByCode(store, code);
  if (!unit) {
    return json({ error: "Unidade não encontrada.", code: "unit-not-found", version: store.meta.version }, { status: 404 });
  }
  return json(buildUnitManifest(store, unit));
});
