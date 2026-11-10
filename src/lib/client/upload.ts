import { newId } from "../slide-meta";

/**
 * Preparação de arquivos no navegador antes do envio:
 * - fotografias: redimensionadas para a TV (até 1920 px no lado maior) e convertidas para WebP < 1 MB;
 * - artes com texto: preservadas quando já adequadas; senão, WebP de alta qualidade (sem compressão agressiva);
 * - original: enviado sem alterações.
 * Cada requisição respeita o limite de 4,5 MB do Vercel.
 */

export type PrepMode = "photo" | "art" | "original";

export interface PreparedUpload {
  clientId: string;
  baseName: string;
  display: Blob;
  original?: Blob;
  kind: "image" | "video";
  width: number;
  height: number;
  mime: string;
  durationSec?: number;
  note: string;
  previewUrl: string;
}

export const REQUEST_BUDGET = 3_900_000;
const PHOTO_TARGET = 1_000_000;
const DISPLAY_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2).replace(".", ",")} MB`;
}

function baseName(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "");
}

function fitBox(w: number, h: number) {
  const portrait = h >= w;
  const maxW = portrait ? 1080 : 1920;
  const maxH = portrait ? 1920 : 1080;
  const s = Math.min(1, maxW / w, maxH / h);
  return { w: Math.round(w * s), h: Math.round(h * s), scaled: s < 1 };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter a imagem."))), type, quality),
  );
}

async function encode(bitmap: ImageBitmap, w: number, h: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  let blob = await toBlob(canvas, "image/webp", quality);
  // Navegadores sem codificador WebP devolvem PNG: usa JPEG de alta qualidade.
  if (blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", Math.max(quality, 0.86));
  canvas.width = canvas.height = 0;
  return blob;
}

async function videoMeta(file: File): Promise<{ width: number; height: number; duration: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      v.onerror = () => reject(new Error("Não foi possível ler o vídeo. Use MP4 (H.264) ou WebM."));
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareUpload(file: File, mode: PrepMode, keepOriginal: boolean): Promise<PreparedUpload> {
  const clientId = newId("up");
  const name = baseName(file.name);

  if (file.type.startsWith("video/")) {
    if (!VIDEO_TYPES.includes(file.type)) throw new Error(`${file.name}: use vídeos MP4 (H.264) ou WebM.`);
    if (file.size > REQUEST_BUDGET) {
      throw new Error(`${file.name}: vídeos devem ter até ${formatBytes(REQUEST_BUDGET)}. Reduza a resolução/duração antes de enviar.`);
    }
    const meta = await videoMeta(file);
    return {
      clientId,
      baseName: name,
      display: file,
      kind: "video",
      width: meta.width || 1080,
      height: meta.height || 1920,
      mime: file.type,
      durationSec: Number.isFinite(meta.duration) ? Math.round(meta.duration * 10) / 10 : undefined,
      note: `Vídeo mantido sem alterações (${formatBytes(file.size)}).`,
      previewUrl: URL.createObjectURL(file),
    };
  }

  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") {
    throw new Error(`${file.name}: formato não suportado. Envie JPEG, PNG ou WebP (fotos HEIC do iPhone precisam ser convertidas).`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${file.name}: não foi possível abrir a imagem.`);
  }

  try {
    const { w, h, scaled } = fitBox(bitmap.width, bitmap.height);
    let display: Blob = file;
    let note = "";

    if (mode === "original") {
      if (!DISPLAY_TYPES.includes(file.type)) throw new Error(`${file.name}: para manter o original, use WebP, JPEG ou PNG.`);
      if (file.size > REQUEST_BUDGET) throw new Error(`${file.name}: o original excede ${formatBytes(REQUEST_BUDGET)}.`);
      note = `Original mantido (${bitmap.width}×${bitmap.height}, ${formatBytes(file.size)}).`;
      return finish(file, bitmap.width, bitmap.height, note);
    }

    if (mode === "art") {
      // Artes com texto pequeno: evita recompressão quando o arquivo já é adequado.
      if (!scaled && DISPLAY_TYPES.includes(file.type) && file.size <= 1_500_000) {
        note = `Arte preservada sem recompressão (${bitmap.width}×${bitmap.height}, ${formatBytes(file.size)}).`;
        return finish(file, bitmap.width, bitmap.height, note);
      }
      display = await encode(bitmap, w, h, 0.95);
      if (display.size > 3_000_000) display = await encode(bitmap, w, h, 0.9);
      note = `Arte convertida para WebP de alta qualidade (${w}×${h}, ${formatBytes(display.size)}).`;
      return finish(display, w, h, note);
    }

    // Fotografias: qualidade decrescente até ficar abaixo de ~1 MB.
    let quality = 0.86;
    let cw = w;
    let ch = h;
    display = await encode(bitmap, cw, ch, quality);
    while (display.size > PHOTO_TARGET && quality > 0.72) {
      quality -= 0.05;
      display = await encode(bitmap, cw, ch, quality);
    }
    while (display.size > PHOTO_TARGET && cw > 800) {
      cw = Math.round(cw * 0.88);
      ch = Math.round(ch * 0.88);
      display = await encode(bitmap, cw, ch, quality);
    }
    note = `Foto otimizada para a TV (${cw}×${ch}, ${formatBytes(display.size)}; original ${formatBytes(file.size)}).`;
    return finish(display, cw, ch, note);
  } finally {
    bitmap.close();
  }

  function finish(blob: Blob, width: number, height: number, note: string): PreparedUpload {
    const keep = keepOriginal && blob !== file && file.size + blob.size <= REQUEST_BUDGET;
    return {
      clientId,
      baseName: name,
      display: blob,
      original: keep ? file : undefined,
      kind: "image",
      width,
      height,
      mime: blob.type || file.type,
      note:
        keepOriginal && blob !== file && !keep
          ? `${note} O original (${formatBytes(file.size)}) excede o limite de envio e não foi guardado; arquive-o no Google Drive.`
          : keep
            ? `${note} Original preservado para documentação.`
            : note,
      previewUrl: URL.createObjectURL(blob),
    };
  }
}

/** Agrupa arquivos em lotes que cabem no limite de uma requisição. */
export function batchUploads(items: PreparedUpload[]): PreparedUpload[][] {
  const batches: PreparedUpload[][] = [];
  let current: PreparedUpload[] = [];
  let size = 0;
  for (const it of items) {
    const s = it.display.size + (it.original?.size ?? 0);
    if (current.length && size + s > REQUEST_BUDGET) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(it);
    size += s;
  }
  if (current.length) batches.push(current);
  return batches;
}

export interface UploadedFile {
  clientId: string;
  path: string;
  originalPath?: string;
  bytes: number;
  mime: string;
  kind: "image" | "video";
}

export function buildForm(batch: PreparedUpload[]): FormData {
  const form = new FormData();
  for (const it of batch) {
    const ext = it.mime.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    form.append(`name:${it.clientId}`, it.baseName);
    form.append(`media:${it.clientId}`, it.display, `${it.baseName}.${ext}`);
    if (it.original)
      form.append(`original:${it.clientId}`, it.original, it.original instanceof File ? it.original.name : `${it.baseName}-original`);
  }
  return form;
}
