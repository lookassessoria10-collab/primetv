import "server-only";

/** Identificação do tipo real do arquivo pelos primeiros bytes (não confia na extensão). */
export interface Sniffed {
  mime: string;
  ext: string;
  kind: "image" | "video";
}

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...Array.from(b.subarray(start, start + len)));

export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { mime: "image/png", ext: "png", kind: "image" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", ext: "webm", kind: "video" };
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif", kind: "image" };
    if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brand)) return { mime: "image/heic", ext: "heic", kind: "image" };
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov", kind: "video" };
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) {
    return { mime: "image/tiff", ext: "tiff", kind: "image" };
  }
  return null;
}

/** Formatos que podem ir para a TV. */
export const DISPLAY_MIMES = new Set(["image/webp", "image/jpeg", "image/png", "image/avif", "video/mp4", "video/webm"]);
/** Formatos aceitos como original para documentação (não exibidos). */
export const ORIGINAL_MIMES = new Set([...DISPLAY_MIMES, "image/heic", "image/tiff", "video/quicktime"]);

/** Limite por requisição no Vercel é 4,5 MB; mantemos folga para o envelope multipart. */
export const MAX_REQUEST_BYTES = 4_300_000;
export const MAX_FILE_BYTES = 4_000_000;

export function slugify(input: string, max = 48): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "arquivo";
}

export function randomToken(len = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function datedFolder(date = new Date()): string {
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
