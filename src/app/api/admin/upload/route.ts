import { requireAdmin } from "@/lib/server/auth";
import {
  datedFolder,
  DISPLAY_MIMES,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  ORIGINAL_MIMES,
  randomToken,
  slugify,
  sniff,
} from "@/lib/server/files";
import { HttpError, json, withErrors } from "@/lib/server/http";
import { getStorage, HeadMovedError, type RepoFile } from "@/lib/server/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recebe arquivos já otimizados no navegador e grava todos em um único commit.
 * Campos do formulário:
 *   media:<id>     arquivo para exibição (public/media/AAAA/MM/...)
 *   original:<id>  original para documentação (archive/originals/..., nunca público)
 *   name:<id>      nome base do arquivo
 */
export const POST = withErrors(async (request: Request) => {
  const session = await requireAdmin(request);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "Envio maior que o limite por requisição (4 MB). Envie menos arquivos por vez.", "too-large");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "Formulário de envio inválido.");
  }

  const folder = datedFolder();
  const files: RepoFile[] = [];
  const results: Record<string, { clientId: string; path?: string; originalPath?: string; bytes?: number; mime?: string; kind?: string }> =
    {};
  let total = 0;

  for (const [field, value] of form.entries()) {
    const [role, clientId] = field.split(":");
    if (!clientId || !/^[a-zA-Z0-9_-]{1,40}$/.test(clientId)) continue;
    if (role !== "media" && role !== "original") continue;
    if (typeof value === "string") continue;
    const bytes = new Uint8Array(await value.arrayBuffer());
    total += bytes.length;
    if (bytes.length === 0) throw new HttpError(400, `Arquivo vazio: ${value.name}`);
    if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, `"${value.name}" excede 4 MB.`, "too-large");
    if (total > MAX_REQUEST_BYTES) throw new HttpError(413, "Envio maior que 4 MB. Envie menos arquivos por vez.", "too-large");

    const type = sniff(bytes);
    const allowed = role === "media" ? DISPLAY_MIMES : ORIGINAL_MIMES;
    if (!type || !allowed.has(type.mime)) {
      throw new HttpError(415, `Formato não suportado em "${value.name}". Use WebP, JPEG, PNG, AVIF, MP4 ou WebM.`, "unsupported");
    }

    const nameField = form.get(`name:${clientId}`);
    const base = slugify(typeof nameField === "string" && nameField ? nameField : value.name);
    const unique = `${base}-${randomToken()}`;
    const entry = (results[clientId] ||= { clientId });
    if (role === "media") {
      const rel = `media/${folder}/${unique}.${type.ext}`;
      files.push({ path: `public/${rel}`, content: bytes });
      Object.assign(entry, { path: rel, bytes: bytes.length, mime: type.mime, kind: type.kind });
    } else {
      const rel = `archive/originals/${folder}/${unique}.${type.ext}`;
      files.push({ path: rel, content: bytes });
      entry.originalPath = rel;
    }
  }

  if (files.length === 0) throw new HttpError(400, "Nenhum arquivo recebido.");
  for (const r of Object.values(results)) {
    if (!r.path) throw new HttpError(400, "Cada original precisa acompanhar o arquivo de exibição.");
  }

  const storage = getStorage();
  let commit: { commit: string; url?: string } | null = null;
  for (let attempt = 0; attempt < 3 && !commit; attempt++) {
    try {
      commit = await storage.commit(files, `Prime TV: envio de ${Object.keys(results).length} mídia(s) por ${session.user}`);
    } catch (e) {
      if (!(e instanceof HeadMovedError)) throw e;
    }
  }
  if (!commit) throw new HttpError(409, "O repositório está ocupado com outras gravações. Tente novamente.", "busy");

  return json({ files: Object.values(results), commit: commit.commit });
});
