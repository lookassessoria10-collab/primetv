import { requireAdmin } from "@/lib/server/auth";
import { sniff } from "@/lib/server/files";
import { HttpError, withErrors } from "@/lib/server/http";
import { getStorage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * Exibe no painel mídias enviadas que ainda não fazem parte do deploy atual
 * (lidas diretamente do repositório). Restrito a administradores.
 */
export const GET = withErrors(async (request: Request, ctx: { params: Promise<{ path: string[] }> }) => {
  await requireAdmin(request);
  const { path } = await ctx.params;
  const rel = path.join("/");
  if (!/^media\/[a-z0-9][a-z0-9_/.-]*$/i.test(rel) || rel.includes("..")) throw new HttpError(400, "Caminho inválido.");
  const data = await getStorage().readBinary(`public/${rel}`);
  if (!data) throw new HttpError(404, "Arquivo não encontrado.");
  const type = sniff(data);
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": type?.mime || "application/octet-stream",
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
