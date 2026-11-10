import { env } from "@/lib/server/env";
import { json, withErrors } from "@/lib/server/http";
import { getBuildInfo, getPublishedStore } from "@/lib/server/published";

export const dynamic = "force-dynamic";

/** Identificação da versão publicada servida por este deploy. */
export const GET = withErrors(async () => {
  const store = getPublishedStore();
  const build = getBuildInfo();
  return json({
    version: store.meta.version,
    publishedAt: store.meta.publishedAt ?? null,
    commit: env.commitSha || build.commit || null,
    builtAt: build.builtAt,
    deployment: env.deploymentId || null,
  });
});
