import { z } from "zod";

// Mensagens de validação em português.
z.config(z.locales.ptBR());

/**
 * Esquema único do conteúdo da Prime TV.
 * O mesmo formato é usado em data/draft.json (rascunho) e data/store.json (publicado).
 */

export const SCHEMA_VERSION = 1;

export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Identificador inválido");

/** Código público da unidade, usado na URL /tv/[codigo]. */
export const UnitCodeSchema = z
  .string()
  .min(2, "Use ao menos 2 caracteres")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens (ex.: unidade-centro)");

/** Data e hora locais (no fuso configurado), formato AAAA-MM-DDTHH:mm. */
export const LocalDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida");
export const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");

export const ScheduleSchema = z.object({
  startAt: LocalDateTimeSchema.optional(),
  endAt: LocalDateTimeSchema.optional(),
  /** 0 = domingo ... 6 = sábado. Vazio = todos os dias. */
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  timeStart: TimeOfDaySchema.optional(),
  timeEnd: TimeOfDaySchema.optional(),
});

export const TRANSITIONS = ["dissolve", "fade", "zoom", "rise", "mask"] as const;
export const TransitionSchema = z.enum(TRANSITIONS);

export const THEMES = ["creme", "rose", "terracota", "chocolate"] as const;
export const ThemeSchema = z.enum(THEMES);

export const ORIENTATIONS = ["portrait", "landscape"] as const;
export const OrientationSchema = z.enum(ORIENTATIONS);

/* ------------------------------------------------------------------ */
/* Mídias                                                              */
/* ------------------------------------------------------------------ */

export const MEDIA_CATEGORIES = ["resultado", "arte", "campanha", "procedimento", "institucional", "ambiente", "marca", "outro"] as const;

export const CONSENT_STATUSES = ["pending", "authorized", "denied"] as const;

export const ClinicalSchema = z.object({
  /** Fotografia de paciente/resultado clínico: exige autorização para ir à TV. */
  isClinical: z.boolean().default(false),
  consent: z.enum(CONSENT_STATUSES).default("pending"),
  /** Referência interna do termo de autorização (nº, pasta, link do arquivo). */
  consentRef: z.string().max(300).optional(),
  reviewedBy: z.string().max(120).optional(),
  reviewedAt: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export const MediaSchema = z.object({
  id: IdSchema,
  kind: z.enum(["image", "video"]),
  /** Origem do arquivo. "repo" = public/ do repositório. "r2" reservado para Cloudflare R2. */
  storage: z.enum(["repo", "r2"]).default("repo"),
  /** Caminho relativo a public/ (repo) ou chave no bucket (r2). Ex.: media/2026/10/foto-ab12cd.webp */
  path: z.string().min(1).max(300),
  /** Original preservado para documentação (fora de public/, nunca exibido na TV). */
  originalPath: z.string().max(300).optional(),
  name: z.string().min(1).max(160),
  category: z.enum(MEDIA_CATEGORIES).default("outro"),
  procedure: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).default([]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  mime: z.string().max(60),
  durationSec: z.number().positive().optional(),
  /** Arte com textos/diagramação: sempre exibida inteira, sem corte. */
  hasText: z.boolean().default(false),
  /** Ponto de interesse para enquadramento (0–100). */
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  status: z.enum(["active", "archived"]).default("active"),
  clinical: ClinicalSchema.default({ isClinical: false, consent: "pending" }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/* ------------------------------------------------------------------ */
/* Peças (slides)                                                      */
/* ------------------------------------------------------------------ */

const text = (max = 400) => z.string().max(max).default("");

export const ArtDataSchema = z.object({
  mediaId: IdSchema.optional(),
  /** Fundo exibido quando a arte não preenche toda a tela (ex.: TV horizontal). */
  background: z.enum(["brand", "blur"]).default("brand"),
  /** Zoom lento (somente para fotografias sem texto). */
  kenBurns: z.boolean().default(false),
  /** Reserva uma faixa inferior com a observação sobre individualidade dos resultados (a arte é reduzida, nunca cortada). */
  showDisclaimer: z.boolean().default(false),
});

export const BeforeAfterDataSchema = z.object({
  /** "photos": duas fotos enviadas separadamente. "composed": peça já diagramada. */
  source: z.enum(["photos", "composed"]).default("photos"),
  composedMediaId: IdSchema.optional(),
  beforeMediaId: IdSchema.optional(),
  afterMediaId: IdSchema.optional(),
  layout: z.enum(["vertical", "sideBySide"]).default("vertical"),
  eyebrow: text(60),
  title: text(120),
  beforeLabel: z.string().max(30).default("Antes"),
  afterLabel: z.string().max(30).default("Depois"),
  showDisclaimer: z.boolean().default(true),
  disclaimer: z.string().max(240).optional(),
  theme: ThemeSchema.default("rose"),
});

export const PromoDataSchema = z.object({
  eyebrow: text(80),
  headline: text(160),
  highlightPrefix: z.string().max(20).default(""),
  highlight: z.string().max(20).default(""),
  highlightSuffix: z.string().max(20).default(""),
  highlightDetail: text(120),
  text: text(240),
  cta: text(120),
  footnote: text(200),
  mediaId: IdSchema.optional(),
  theme: ThemeSchema.default("chocolate"),
});

export const ProcedureDataSchema = z.object({
  eyebrow: text(60),
  title: text(120),
  text: text(280),
  cta: text(120),
  mediaId: IdSchema.optional(),
  theme: ThemeSchema.default("creme"),
});

export const InstitutionalDataSchema = z.object({
  variant: z.enum(["opening", "message", "closing"]).default("message"),
  eyebrow: text(80),
  title: text(200),
  text: text(280),
  cta: text(120),
  mediaId: IdSchema.optional(),
  theme: ThemeSchema.default("terracota"),
  showLogo: z.boolean().default(true),
});

export const CtaDataSchema = z.object({
  eyebrow: text(80),
  title: text(160),
  text: text(240),
  /** Exibe o WhatsApp configurado na unidade (ou o geral). Nunca inventado. */
  showWhatsapp: z.boolean().default(true),
  showQr: z.boolean().default(true),
  qrTarget: z.enum(["whatsapp", "url"]).default("whatsapp"),
  url: z.string().max(300).optional(),
  qrLabel: text(80),
  mediaId: IdSchema.optional(),
  theme: ThemeSchema.default("chocolate"),
});

export const VideoDataSchema = z.object({
  mediaId: IdSchema.optional(),
  /** Imagem exibida se o vídeo não puder ser reproduzido. */
  posterMediaId: IdSchema.optional(),
});

export const SLIDE_TYPES = ["art", "beforeAfter", "promo", "procedure", "institutional", "cta", "video"] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

const slideBase = {
  id: IdSchema,
  name: z.string().min(1).max(120),
  durationSec: z.number().min(2).max(600).default(8),
  transition: TransitionSchema.default("dissolve"),
  status: z.enum(["active", "archived"]).default("active"),
  notes: z.string().max(1000).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const SlideSchema = z.discriminatedUnion("type", [
  z.object({ ...slideBase, type: z.literal("art"), data: ArtDataSchema }),
  z.object({ ...slideBase, type: z.literal("beforeAfter"), data: BeforeAfterDataSchema }),
  z.object({ ...slideBase, type: z.literal("promo"), data: PromoDataSchema }),
  z.object({ ...slideBase, type: z.literal("procedure"), data: ProcedureDataSchema }),
  z.object({ ...slideBase, type: z.literal("institutional"), data: InstitutionalDataSchema }),
  z.object({ ...slideBase, type: z.literal("cta"), data: CtaDataSchema }),
  z.object({ ...slideBase, type: z.literal("video"), data: VideoDataSchema }),
]);

/** Modelo reutilizável salvo pelo administrador. */
export const TemplateSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  slide: z.discriminatedUnion("type", [
    z.object({ type: z.literal("art"), durationSec: z.number(), transition: TransitionSchema, data: ArtDataSchema }),
    z.object({ type: z.literal("beforeAfter"), durationSec: z.number(), transition: TransitionSchema, data: BeforeAfterDataSchema }),
    z.object({ type: z.literal("promo"), durationSec: z.number(), transition: TransitionSchema, data: PromoDataSchema }),
    z.object({ type: z.literal("procedure"), durationSec: z.number(), transition: TransitionSchema, data: ProcedureDataSchema }),
    z.object({ type: z.literal("institutional"), durationSec: z.number(), transition: TransitionSchema, data: InstitutionalDataSchema }),
    z.object({ type: z.literal("cta"), durationSec: z.number(), transition: TransitionSchema, data: CtaDataSchema }),
    z.object({ type: z.literal("video"), durationSec: z.number(), transition: TransitionSchema, data: VideoDataSchema }),
  ]),
  createdAt: z.string(),
});

/* ------------------------------------------------------------------ */
/* Campanhas, programação e unidades                                   */
/* ------------------------------------------------------------------ */

export const CampaignItemSchema = z.object({
  slideId: IdSchema,
  durationSec: z.number().min(2).max(600).optional(),
});

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"] as const;

export const CampaignSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  /** Descrição interna (não aparece na TV). */
  description: z.string().max(2000).default(""),
  /** Ativação manual. Só campanhas "active" entram na programação, respeitando o período. */
  status: z.enum(CAMPAIGN_STATUSES).default("draft"),
  /** Identidade/tema da campanha (ex.: Black Friday). Uso interno e organização. */
  theme: z.string().max(80).default(""),
  schedule: ScheduleSchema.default({}),
  scope: z.enum(["global", "units"]).default("global"),
  unitIds: z.array(IdSchema).default([]),
  items: z.array(CampaignItemSchema).default([]),
  /** 1 (baixa) a 10 (alta): ordem de preferência nos espaços de campanha. */
  priority: z.number().int().min(1).max(10).default(5),
  /** 1 a 10: frequência relativa entre campanhas ativas ao mesmo tempo. */
  weight: z.number().int().min(1).max(10).default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PlaylistSlideItemSchema = z.object({
  id: IdSchema,
  kind: z.literal("slide"),
  slideId: IdSchema,
  durationSec: z.number().min(2).max(600).optional(),
  transition: TransitionSchema.optional(),
  hidden: z.boolean().default(false),
  /** Quando definido, a peça só aparece enquanto essa campanha estiver ativa. */
  campaignId: IdSchema.optional(),
  schedule: ScheduleSchema.optional(),
});

export const PlaylistCampaignSlotSchema = z.object({
  id: IdSchema,
  kind: z.literal("campaign"),
  label: z.string().max(80).default("Espaço de campanha"),
  durationSec: z.number().min(2).max(600).optional(),
  transition: TransitionSchema.optional(),
  hidden: z.boolean().default(false),
  /** Restringe o espaço a campanhas específicas. Vazio = qualquer campanha ativa. */
  campaignIds: z.array(IdSchema).default([]),
  /** Peça exibida quando não há campanha ativa. Vazio = o espaço é pulado. */
  fallbackSlideId: IdSchema.optional(),
});

export const PlaylistItemSchema = z.discriminatedUnion("kind", [PlaylistSlideItemSchema, PlaylistCampaignSlotSchema]);

export const PlaylistSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  items: z.array(PlaylistItemSchema).default([]),
});

export const UnitSchema = z.object({
  id: IdSchema,
  code: UnitCodeSchema,
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional(),
  /** Somente dígitos, com DDI e DDD (ex.: 5571999999999). */
  whatsapp: z
    .string()
    .regex(/^\d{10,15}$/, "Informe DDI + DDD + número, somente dígitos")
    .optional(),
  whatsappMessage: z.string().max(300).optional(),
  /** Mensagem personalizada da unidade, usada em chamadas para ação. */
  ctaMessage: z.string().max(200).optional(),
  orientation: OrientationSchema.default("portrait"),
  /** Rotação aplicada à tela quando a TV não gira a imagem sozinha. */
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  /** Margem de segurança para TVs com overscan (0–8%). */
  overscanPercent: z.number().min(0).max(8).default(0),
  playlistId: IdSchema,
  /** Programação institucional padrão, usada se a principal ficar vazia. */
  fallbackPlaylistId: IdSchema.optional(),
  /** Se a programação não tiver espaços de campanha, insere campanhas a cada N peças (0 = não insere). */
  autoCampaignEvery: z.number().int().min(0).max(20).default(4),
  active: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const SettingsSchema = z.object({
  brandName: z.string().min(1).max(80).default("Prime Esthetics"),
  tagline: z.string().max(80).default("Estética Avançada"),
  /** Logotipos alternativos (mídias). Sem valor = arquivos em public/brand. */
  logoLightMediaId: IdSchema.optional(),
  logoDarkMediaId: IdSchema.optional(),
  timezone: z.string().min(1).max(60).default("America/Bahia"),
  defaultDurationSec: z.number().min(2).max(600).default(8),
  defaultTransition: TransitionSchema.default("dissolve"),
  transitionMs: z.number().int().min(300).max(4000).default(1400),
  resultsDisclaimer: z.string().max(240).default(""),
  contact: z
    .object({
      whatsapp: z
        .string()
        .regex(/^\d{10,15}$/, "Informe DDI + DDD + número, somente dígitos")
        .optional(),
      whatsappMessage: z.string().max(300).optional(),
      instagram: z.string().max(60).optional(),
      website: z.string().max(200).optional(),
    })
    .default({}),
  fallback: z
    .object({
      mediaId: IdSchema.optional(),
      title: z.string().max(120).default(""),
      message: z.string().max(200).default(""),
    })
    .default({ title: "", message: "" }),
  player: z
    .object({
      /** Intervalo de verificação de novas versões. */
      pollSeconds: z.number().int().min(15).max(3600).default(60),
      /** Recarregamento preventivo da página (0 = desativado). */
      reloadHours: z.number().min(0).max(72).default(6),
    })
    .default({ pollSeconds: 60, reloadHours: 6 }),
});

export const StoreMetaSchema = z.object({
  revision: z.number().int().nonnegative().default(0),
  version: z.string().max(80).default("inicial"),
  updatedAt: z.string().default(""),
  publishedAt: z.string().optional(),
  /** Registro da última publicação (somente no rascunho). */
  lastPublish: z
    .object({
      version: z.string(),
      at: z.string(),
      by: z.string().optional(),
      revision: z.number().int().optional(),
      commit: z.string().optional(),
    })
    .optional(),
});

export const StoreSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  meta: StoreMetaSchema,
  settings: SettingsSchema,
  units: z.array(UnitSchema).default([]),
  playlists: z.array(PlaylistSchema).default([]),
  slides: z.array(SlideSchema).default([]),
  campaigns: z.array(CampaignSchema).default([]),
  media: z.array(MediaSchema).default([]),
  templates: z.array(TemplateSchema).default([]),
});

export type Schedule = z.infer<typeof ScheduleSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type MediaCategory = Media["category"];
export type Clinical = z.infer<typeof ClinicalSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type SlideOf<T extends SlideType> = Extract<Slide, { type: T }>;
export type SlideData<T extends SlideType> = SlideOf<T>["data"];
export type Template = z.infer<typeof TemplateSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type CampaignItem = z.infer<typeof CampaignItemSchema>;
export type CampaignStatus = Campaign["status"];
export type PlaylistItem = z.infer<typeof PlaylistItemSchema>;
export type PlaylistSlideItem = z.infer<typeof PlaylistSlideItemSchema>;
export type PlaylistCampaignSlot = z.infer<typeof PlaylistCampaignSlotSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type StoreMeta = z.infer<typeof StoreMetaSchema>;
export type Store = z.infer<typeof StoreSchema>;

export function parseStore(input: unknown): Store {
  return StoreSchema.parse(input);
}

export function safeParseStore(input: unknown) {
  return StoreSchema.safeParse(input);
}

const COLLECTION_LABEL: Record<string, string> = {
  units: "Unidade",
  playlists: "Programação",
  slides: "Peça",
  campaigns: "Campanha",
  media: "Mídia",
  templates: "Modelo",
  settings: "Configurações",
};

/** Mensagens legíveis para problemas de validação do documento. */
export function describeIssues(store: unknown, issues: { path: PropertyKey[]; message: string }[]): string[] {
  const root = (store && typeof store === "object" ? store : {}) as Record<string, unknown>;
  return issues.slice(0, 8).map((i) => {
    const [col, idx, ...rest] = i.path.map(String);
    const label = COLLECTION_LABEL[col] ?? col;
    const list = root[col];
    const entity = Array.isArray(list) && idx !== undefined ? (list[Number(idx)] as { name?: string } | undefined) : undefined;
    const where = entity?.name ? `${label} “${entity.name}”` : label;
    const field = (Array.isArray(list) ? rest : [idx, ...rest]).filter((x) => x !== undefined).join(" › ");
    return `${where}${field ? ` (${field})` : ""}: ${i.message}`;
  });
}
