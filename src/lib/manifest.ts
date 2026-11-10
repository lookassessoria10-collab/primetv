import { campaignAppliesToUnit } from "./schedule";
import type {
  Campaign,
  Media,
  Orientation,
  Playlist,
  PlaylistItem,
  Schedule,
  Settings,
  Slide,
  SlideType,
  Store,
  Transition,
  Unit,
} from "./schema";

/**
 * Manifesto de reprodução de uma unidade: tudo o que o player precisa, sem dados internos
 * (descrições, autorizações, notas). É gerado igualmente no servidor (TV) e no painel (prévia),
 * garantindo que a prévia use exatamente as mesmas regras da TV.
 */

export const MANIFEST_VERSION = 1;

export interface ResolvedMedia {
  id: string;
  url: string;
  kind: "image" | "video";
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  hasText: boolean;
  mime: string;
}

export interface TvSlide {
  id: string;
  type: SlideType;
  name: string;
  durationSec: number;
  transition: Transition;
  data: Slide["data"];
  media: Record<string, ResolvedMedia>;
}

export type SeqEntry =
  | {
      kind: "slide";
      key: string;
      slideId: string;
      durationSec?: number;
      transition?: Transition;
      schedule?: Schedule;
      campaignId?: string;
    }
  | {
      kind: "campaign";
      key: string;
      label: string;
      durationSec?: number;
      transition?: Transition;
      campaignIds: string[];
      fallbackSlideId?: string;
    };

export interface TvCampaign {
  id: string;
  name: string;
  schedule: Schedule;
  priority: number;
  weight: number;
  items: { slideId: string; durationSec?: number }[];
}

export interface TvBrand {
  name: string;
  tagline: string;
  logoLight: string;
  logoDark: string;
  symbolLight: string;
  symbolGold: string;
  symbolDark: string;
}

export interface TvUnitInfo {
  id: string;
  code: string;
  name: string;
  active: boolean;
  orientation: Orientation;
  rotation: 0 | 90 | 180 | 270;
  overscanPercent: number;
  whatsapp?: string;
  whatsappMessage?: string;
  ctaMessage?: string;
  address?: string;
  autoCampaignEvery: number;
}

export interface TvSettings {
  timezone: string;
  defaultDurationSec: number;
  defaultTransition: Transition;
  transitionMs: number;
  resultsDisclaimer: string;
  contact: Settings["contact"];
  fallback: { title: string; message: string; imageUrl?: string };
  player: Settings["player"];
}

export interface TvManifest {
  manifestVersion: number;
  schemaVersion: number;
  version: string;
  publishedAt?: string;
  unit: TvUnitInfo;
  brand: TvBrand;
  settings: TvSettings;
  slides: Record<string, TvSlide>;
  main: SeqEntry[];
  fallback: SeqEntry[];
  campaigns: TvCampaign[];
}

export type MediaUrlResolver = (media: Media) => string;

/** URL pública padrão: arquivos do repositório publicados em /public. */
export const publicMediaUrl: MediaUrlResolver = (m) => {
  if (m.storage === "r2") {
    const base = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MEDIA_BASE_URL) || "";
    return base ? `${base.replace(/\/$/, "")}/${m.path}` : `/${m.path}`;
  }
  return `/${m.path.replace(/^\/+/, "")}`;
};

export const DEFAULT_BRAND_FILES = {
  logoLight: "/brand/logo-white.png",
  logoDark: "/brand/logo-brown.png",
  symbolLight: "/brand/symbol-white.png",
  symbolGold: "/brand/symbol-gold.png",
  symbolDark: "/brand/symbol-brown.png",
};

/** Mídias referenciadas por uma peça. `required` impede a exibição se faltar. */
export function slideMediaRefs(slide: Slide): { id: string; required: boolean; role: string }[] {
  const out: { id: string; required: boolean; role: string }[] = [];
  const push = (id: string | undefined, required: boolean, role: string) => {
    if (id) out.push({ id, required, role });
    else if (required) out.push({ id: "", required, role });
  };
  switch (slide.type) {
    case "art":
      push(slide.data.mediaId, true, "Arte");
      break;
    case "beforeAfter":
      if (slide.data.source === "composed") push(slide.data.composedMediaId, true, "Peça diagramada");
      else {
        push(slide.data.beforeMediaId, true, "Foto antes");
        push(slide.data.afterMediaId, true, "Foto depois");
      }
      break;
    case "video":
      push(slide.data.mediaId, true, "Vídeo");
      push(slide.data.posterMediaId, false, "Imagem de substituição");
      break;
    default:
      push((slide.data as { mediaId?: string }).mediaId, false, "Imagem");
  }
  return out;
}

export type MediaBlockReason = "missing" | "archived" | "consent-pending" | "consent-denied";

export const MEDIA_BLOCK_LABEL: Record<MediaBlockReason, string> = {
  missing: "mídia não encontrada",
  archived: "mídia arquivada",
  "consent-pending": "autorização de uso pendente",
  "consent-denied": "uso não autorizado",
};

export function mediaBlockReason(m: Media | undefined): MediaBlockReason | null {
  if (!m) return "missing";
  if (m.status !== "active") return "archived";
  if (m.clinical?.isClinical) {
    if (m.clinical.consent === "denied") return "consent-denied";
    if (m.clinical.consent !== "authorized") return "consent-pending";
  }
  return null;
}

export interface SlideAvailability {
  ok: boolean;
  reasons: string[];
}

/** Uma peça só vai para a TV se estiver ativa e todas as mídias obrigatórias puderem ser exibidas. */
export function slideAvailability(slide: Slide | undefined, mediaById: Map<string, Media>): SlideAvailability {
  if (!slide) return { ok: false, reasons: ["peça não encontrada"] };
  const reasons: string[] = [];
  if (slide.status !== "active") reasons.push("peça arquivada");
  for (const ref of slideMediaRefs(slide)) {
    if (!ref.required) continue;
    if (!ref.id) {
      reasons.push(`${ref.role}: não selecionada`);
      continue;
    }
    const why = mediaBlockReason(mediaById.get(ref.id));
    if (why) reasons.push(`${ref.role}: ${MEDIA_BLOCK_LABEL[why]}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function resolveMedia(m: Media, resolveUrl: MediaUrlResolver): ResolvedMedia {
  return {
    id: m.id,
    url: resolveUrl(m),
    kind: m.kind,
    width: m.width,
    height: m.height,
    focalX: m.focalX,
    focalY: m.focalY,
    hasText: m.hasText,
    mime: m.mime,
  };
}

export function toTvSlide(
  slide: Slide,
  mediaById: Map<string, Media>,
  resolveUrl: MediaUrlResolver,
  /** Somente no editor: mostra mídias bloqueadas para o administrador conferir. */
  includeBlocked = false,
): TvSlide {
  const media: Record<string, ResolvedMedia> = {};
  for (const ref of slideMediaRefs(slide)) {
    if (!ref.id) continue;
    const m = mediaById.get(ref.id);
    // Mídias opcionais bloqueadas (ex.: sem autorização) são simplesmente omitidas.
    if (m && (includeBlocked || !mediaBlockReason(m))) media[ref.id] = resolveMedia(m, resolveUrl);
  }
  return {
    id: slide.id,
    type: slide.type,
    name: slide.name,
    durationSec: slide.durationSec,
    transition: slide.transition,
    data: slide.data,
    media,
  };
}

export function buildBrand(settings: Settings, mediaById: Map<string, Media>, resolveUrl: MediaUrlResolver): TvBrand {
  const light = settings.logoLightMediaId ? mediaById.get(settings.logoLightMediaId) : undefined;
  const dark = settings.logoDarkMediaId ? mediaById.get(settings.logoDarkMediaId) : undefined;
  return {
    name: settings.brandName,
    tagline: settings.tagline,
    logoLight: light && !mediaBlockReason(light) ? resolveUrl(light) : DEFAULT_BRAND_FILES.logoLight,
    logoDark: dark && !mediaBlockReason(dark) ? resolveUrl(dark) : DEFAULT_BRAND_FILES.logoDark,
    symbolLight: DEFAULT_BRAND_FILES.symbolLight,
    symbolGold: DEFAULT_BRAND_FILES.symbolGold,
    symbolDark: DEFAULT_BRAND_FILES.symbolDark,
  };
}

function seqFromPlaylist(playlist: Playlist | undefined, usable: (slideId: string) => boolean): SeqEntry[] {
  if (!playlist) return [];
  const out: SeqEntry[] = [];
  for (const item of playlist.items as PlaylistItem[]) {
    if (item.hidden) continue;
    if (item.kind === "slide") {
      if (!usable(item.slideId)) continue;
      out.push({
        kind: "slide",
        key: item.id,
        slideId: item.slideId,
        durationSec: item.durationSec,
        transition: item.transition,
        schedule: item.schedule,
        campaignId: item.campaignId,
      });
    } else {
      out.push({
        kind: "campaign",
        key: item.id,
        label: item.label,
        durationSec: item.durationSec,
        transition: item.transition,
        campaignIds: item.campaignIds,
        fallbackSlideId: item.fallbackSlideId && usable(item.fallbackSlideId) ? item.fallbackSlideId : undefined,
      });
    }
  }
  return out;
}

export interface BuildOptions {
  resolveUrl?: MediaUrlResolver;
}

export function findUnitByCode(store: Store, code: string): Unit | undefined {
  const c = code.toLowerCase();
  return store.units.find((u) => u.code === c);
}

export function buildUnitManifest(store: Store, unit: Unit, opts: BuildOptions = {}): TvManifest {
  const resolveUrl = opts.resolveUrl ?? publicMediaUrl;
  const mediaById = new Map(store.media.map((m) => [m.id, m]));
  const slideById = new Map(store.slides.map((s) => [s.id, s]));
  const availability = new Map<string, boolean>();
  const usable = (slideId: string) => {
    let ok = availability.get(slideId);
    if (ok === undefined) {
      ok = slideAvailability(slideById.get(slideId), mediaById).ok;
      availability.set(slideId, ok);
    }
    return ok;
  };

  const settings = store.settings;
  const playlist = store.playlists.find((p) => p.id === unit.playlistId);
  const fallbackPlaylist = unit.fallbackPlaylistId ? store.playlists.find((p) => p.id === unit.fallbackPlaylistId) : undefined;

  const main = unit.active ? seqFromPlaylist(playlist, usable) : [];
  const fallback = unit.active ? seqFromPlaylist(fallbackPlaylist, usable) : [];

  const campaigns: TvCampaign[] = unit.active
    ? store.campaigns
        .filter((c: Campaign) => c.status === "active" && campaignAppliesToUnit(c, unit.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          schedule: c.schedule,
          priority: c.priority,
          weight: c.weight,
          items: c.items.filter((it) => usable(it.slideId)).map((it) => ({ slideId: it.slideId, durationSec: it.durationSec })),
        }))
        .filter((c) => c.items.length > 0)
    : [];

  // Apenas as peças efetivamente usadas pela unidade entram no manifesto.
  const used = new Set<string>();
  for (const e of [...main, ...fallback]) {
    if (e.kind === "slide") used.add(e.slideId);
    else if (e.fallbackSlideId) used.add(e.fallbackSlideId);
  }
  for (const c of campaigns) for (const it of c.items) used.add(it.slideId);

  const slides: Record<string, TvSlide> = {};
  for (const id of used) {
    const s = slideById.get(id);
    if (s && usable(id)) slides[id] = toTvSlide(s, mediaById, resolveUrl);
  }

  const fallbackMedia = settings.fallback.mediaId ? mediaById.get(settings.fallback.mediaId) : undefined;

  return {
    manifestVersion: MANIFEST_VERSION,
    schemaVersion: store.schemaVersion,
    version: store.meta.version,
    publishedAt: store.meta.publishedAt,
    unit: {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      active: unit.active,
      orientation: unit.orientation,
      rotation: unit.rotation,
      overscanPercent: unit.overscanPercent,
      whatsapp: unit.whatsapp || settings.contact.whatsapp,
      whatsappMessage: unit.whatsappMessage || settings.contact.whatsappMessage,
      ctaMessage: unit.ctaMessage,
      address: unit.address,
      autoCampaignEvery: unit.autoCampaignEvery,
    },
    brand: buildBrand(settings, mediaById, resolveUrl),
    settings: {
      timezone: settings.timezone,
      defaultDurationSec: settings.defaultDurationSec,
      defaultTransition: settings.defaultTransition,
      transitionMs: settings.transitionMs,
      resultsDisclaimer: settings.resultsDisclaimer,
      contact: settings.contact,
      fallback: {
        title: settings.fallback.title,
        message: settings.fallback.message,
        imageUrl: fallbackMedia && !mediaBlockReason(fallbackMedia) ? resolveUrl(fallbackMedia) : undefined,
      },
      player: settings.player,
    },
    slides,
    main,
    fallback,
    campaigns,
  };
}

/** URLs de todas as mídias de um manifesto (para pré-carregamento e cache). */
export function manifestMediaUrls(m: TvManifest): string[] {
  const urls = new Set<string>();
  for (const s of Object.values(m.slides)) for (const md of Object.values(s.media)) urls.add(md.url);
  urls.add(m.brand.logoLight);
  urls.add(m.brand.logoDark);
  urls.add(m.brand.symbolGold);
  urls.add(m.brand.symbolLight);
  if (m.settings.fallback.imageUrl) urls.add(m.settings.fallback.imageUrl);
  return Array.from(urls);
}

/** Link do WhatsApp a partir do número configurado (nunca inventado). */
export function whatsappLink(number: string | undefined, message?: string): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** Formata 5571999998888 → (71) 99999-8888 */
export function formatPhone(number: string | undefined): string {
  if (!number) return "";
  let d = number.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return number;
}
