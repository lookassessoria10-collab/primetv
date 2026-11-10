import { requireAdmin } from "@/lib/server/auth";
import { publish } from "@/lib/server/content";
import { env } from "@/lib/server/env";
import { HttpError, json, withErrors } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Valida, grava store.json + draft.json em um único commit e devolve a versão gerada. */
export const POST = withErrors(async (request: Request) => {
  const session = await requireAdmin(request);
  let body: { draft?: unknown; baseRevision?: unknown };
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Requisição inválida.");
  }
  if (typeof body.baseRevision !== "number") throw new HttpError(400, "Revisão de base ausente.");
  const result = await publish(body.draft, body.baseRevision, session.user);
  return json({ ...result, mode: env.storageDriver });
});
