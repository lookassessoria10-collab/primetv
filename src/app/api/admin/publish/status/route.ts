import { requireAdmin } from "@/lib/server/auth";
import { json, withErrors } from "@/lib/server/http";
import { getPublishedStore } from "@/lib/server/published";
import { getStorage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * Acompanha uma publicação.
 * "published" só é informado quando ESTE deploy (o que atende o domínio agora) já serve a versão.
 */
export const GET = withErrors(async (request: Request) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const version = url.searchParams.get("version") || "";
  const commit = url.searchParams.get("commit") || "";

  const live = getPublishedStore().meta.version;
  if (version && live === version) {
    return json({ state: "published", liveVersion: live });
  }

  const storage = getStorage();
  const deploy = commit ? await storage.deployStatus(commit) : { state: "unknown" as const };
  if (deploy.state === "failure") {
    return json({
      state: "error",
      liveVersion: live,
      message: deploy.description || "O deploy falhou no Vercel.",
      targetUrl: deploy.targetUrl,
    });
  }
  return json({
    state: "deploying",
    liveVersion: live,
    deploy: deploy.state,
    message:
      deploy.state === "success"
        ? "Deploy concluído no Vercel; aguardando o domínio passar a servir a nova versão."
        : deploy.state === "pending"
          ? deploy.description || "Vercel gerando a nova versão."
          : "Aguardando o Vercel iniciar o deploy.",
    targetUrl: deploy.targetUrl,
  });
});
