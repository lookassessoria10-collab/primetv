#!/usr/bin/env node
/**
 * Gera os dados demonstrativos iniciais (data/store.json e data/draft.json).
 * ATENÇÃO: sobrescreve os arquivos existentes. Use apenas para reiniciar a demonstração:
 *   node scripts/seed.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv.includes("--force") && fs.existsSync(path.join(root, "data", "store.json"))) {
  console.error("data/store.json já existe. Use --force para sobrescrever.");
  process.exit(1);
}

const now = new Date().toISOString();
const IMPORT_NOTE =
  "Importado do material Prime TV fornecido pela clínica para exibição. Registre aqui a referência do termo de autorização de uso de imagem.";

const media = (id, file, extra) => ({
  id,
  kind: "image",
  storage: "repo",
  path: `media/seed/${file}`,
  tags: [],
  mime: "image/webp",
  focalX: 50,
  focalY: 50,
  status: "active",
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const clinicalAuthorized = {
  isClinical: true,
  consent: "authorized",
  reviewedBy: "Importação inicial",
  notes: IMPORT_NOTE,
};
const notClinical = { isClinical: false, consent: "pending" };

const MEDIA = [
  media("med_papada", "ultraformer-mpt-papada.webp", {
    name: "Ultraformer MPT Papada — antes e depois",
    category: "resultado",
    procedure: "Ultraformer MPT",
    width: 1080,
    height: 1920,
    bytes: 111920,
    hasText: true,
    clinical: clinicalAuthorized,
  }),
  media("med_pescoco", "ultraformer-mpt-pescoco.webp", {
    name: "Ultraformer MPT Pescoço — antes e depois",
    category: "resultado",
    procedure: "Ultraformer MPT",
    width: 1080,
    height: 1920,
    bytes: 135960,
    hasText: true,
    clinical: clinicalAuthorized,
  }),
  media("med_labial", "preenchimento-labial.webp", {
    name: "Preenchimento labial — antes e depois",
    category: "resultado",
    procedure: "Preenchimento labial",
    width: 1080,
    height: 1920,
    bytes: 105914,
    hasText: true,
    clinical: clinicalAuthorized,
  }),
  media("med_microvasos", "microvasos-peim.webp", {
    name: "Microvasos ou PEIM — antes e depois",
    category: "resultado",
    procedure: "Microvasos (PEIM)",
    width: 1080,
    height: 1920,
    bytes: 131664,
    hasText: true,
    clinical: clinicalAuthorized,
  }),
  media("med_institucional", "institucional-ocasioes-especiais.webp", {
    name: "Institucional — formatura, festa ou evento especial",
    category: "institucional",
    width: 1080,
    height: 1920,
    bytes: 142638,
    hasText: true,
    clinical: notClinical,
  }),
  media("med_bf_quer_saber", "black-friday-quer-saber.webp", {
    name: "Black Friday — Quer saber quais protocolos",
    category: "campanha",
    width: 941,
    height: 1672,
    bytes: 226434,
    hasText: true,
    clinical: notClinical,
    tags: ["black friday"],
  }),
  media("med_bf_condicao", "condicao-especial-30-off.webp", {
    name: "Black Friday — Condição especial 30% OFF",
    category: "campanha",
    width: 941,
    height: 1672,
    bytes: 114964,
    hasText: true,
    clinical: notClinical,
    tags: ["black friday"],
  }),
  media("med_bf_resultados", "black-friday-resultados-bonitos.webp", {
    name: "Black Friday — Resultados bonitos começam antes",
    category: "campanha",
    width: 941,
    height: 1672,
    bytes: 230006,
    hasText: true,
    clinical: notClinical,
    tags: ["black friday"],
  }),
  media("med_bf_nao_esperar", "black-friday-nao-precisa-esperar.webp", {
    name: "Black Friday — Você não precisa esperar",
    category: "campanha",
    width: 941,
    height: 1672,
    bytes: 166570,
    hasText: true,
    clinical: notClinical,
    tags: ["black friday"],
  }),
  media("med_labial_foto", "preenchimento-labial-foto.webp", {
    name: "Preenchimento labial — foto (recorte do resultado)",
    category: "procedimento",
    procedure: "Preenchimento labial",
    width: 904,
    height: 920,
    bytes: 43090,
    hasText: false,
    focalY: 45,
    clinical: clinicalAuthorized,
  }),
  media("med_microvasos_foto", "microvasos-foto.webp", {
    name: "Microvasos — foto (recorte do resultado)",
    category: "procedimento",
    procedure: "Microvasos (PEIM)",
    width: 1740,
    height: 890,
    bytes: 82282,
    hasText: false,
    focalX: 40,
    clinical: clinicalAuthorized,
  }),
];

const slide = (id, name, type, durationSec, transition, data) => ({
  id,
  name,
  type,
  durationSec,
  transition,
  status: "active",
  createdAt: now,
  updatedAt: now,
  data,
});
const art = (mediaId, extra = {}) => ({ mediaId, background: "brand", kenBurns: false, showDisclaimer: false, ...extra });

const SLIDES = [
  slide("sl_abertura", "Abertura institucional", "institutional", 5, "fade", {
    variant: "opening",
    eyebrow: "",
    title: "",
    text: "",
    cta: "",
    theme: "chocolate",
    showLogo: true,
  }),
  slide("sl_editorial", "Mensagem editorial — características únicas", "institutional", 7, "rise", {
    variant: "message",
    eyebrow: "Cuidado individual",
    title: "Seu rosto tem características *únicas*.",
    text: "Seu tratamento também deve considerar isso.",
    cta: "",
    theme: "creme",
    showLogo: true,
  }),
  slide("sl_papada", "Resultado — Ultraformer MPT Papada", "art", 10, "dissolve", art("med_papada", { showDisclaimer: true })),
  slide("sl_labial_destaque", "Destaque — Preenchimento labial", "procedure", 7, "zoom", {
    eyebrow: "Procedimento",
    title: "Preenchimento labial",
    text: "Equilíbrio, proporção e avaliação individual.",
    cta: "Agende sua avaliação",
    mediaId: "med_labial_foto",
    theme: "rose",
  }),
  slide("sl_pescoco", "Resultado — Ultraformer MPT Pescoço", "art", 10, "dissolve", art("med_pescoco", { showDisclaimer: true })),
  slide("sl_institucional", "Institucional — ocasiões especiais", "art", 6, "dissolve", art("med_institucional")),
  slide("sl_labial", "Resultado — Preenchimento labial", "art", 10, "dissolve", art("med_labial", { showDisclaimer: true })),
  slide("sl_microvasos_destaque", "Destaque — Microvasos ou PEIM", "procedure", 10, "zoom", {
    eyebrow: "Procedimento",
    title: "Microvasos ou PEIM",
    text: "Procedimento Estético Injetável para Microvasos, com indicação definida em avaliação individual.",
    cta: "Converse com nossa equipe",
    mediaId: "med_microvasos_foto",
    theme: "creme",
  }),
  slide("sl_microvasos", "Resultado — Microvasos ou PEIM", "art", 10, "dissolve", art("med_microvasos", { showDisclaimer: true })),
  slide("sl_contato", "Chamada para contato", "cta", 8, "rise", {
    eyebrow: "Fale com a Prime",
    title: "O seu próximo cuidado pode começar *hoje*.",
    text: "Converse com nossa equipe e agende sua avaliação.",
    showWhatsapp: true,
    showQr: true,
    qrTarget: "whatsapp",
    qrLabel: "Aponte a câmera do celular",
    theme: "chocolate",
  }),
  slide("sl_encerramento", "Encerramento — convite à avaliação", "institutional", 8, "mask", {
    variant: "closing",
    eyebrow: "",
    title: "Cuidado estético começa com uma *boa avaliação*.",
    text: "",
    cta: "Agende sua avaliação",
    theme: "terracota",
    showLogo: true,
  }),
  slide("sl_bf_oferta", "Black Friday — oferta 30% OFF", "promo", 8, "zoom", {
    eyebrow: "Esquenta Prime Black Friday",
    headline: "Quer conhecer os procedimentos *participantes*?",
    highlightPrefix: "Até",
    highlight: "30%",
    highlightSuffix: "OFF",
    highlightDetail: "em protocolos selecionados",
    text: "",
    cta: "Converse com nossa equipe",
    footnote: "Consulte as condições com nossa equipe.",
    theme: "chocolate",
  }),
  slide("sl_bf_nao_esperar", "Black Friday — Você não precisa esperar", "art", 8, "dissolve", art("med_bf_nao_esperar")),
  slide("sl_bf_resultados", "Black Friday — Resultados bonitos começam antes", "art", 8, "dissolve", art("med_bf_resultados")),
  slide("sl_bf_condicao", "Black Friday — Condição especial", "art", 8, "dissolve", art("med_bf_condicao")),
  slide("sl_bf_quer_saber", "Black Friday — Quer saber quais protocolos", "art", 8, "dissolve", art("med_bf_quer_saber")),
];

const item = (id, slideId, durationSec) => ({ id, kind: "slide", slideId, durationSec, hidden: false });
const PLAYLISTS = [
  {
    id: "pl_principal",
    name: "Programação principal",
    description: "Sequência demonstrativa com 12 telas.",
    items: [
      item("it_01", "sl_abertura", 5),
      item("it_02", "sl_editorial", 7),
      item("it_03", "sl_papada", 10),
      item("it_04", "sl_labial_destaque", 7),
      {
        id: "it_05",
        kind: "campaign",
        label: "Campanha em destaque",
        durationSec: 8,
        hidden: false,
        campaignIds: [],
        fallbackSlideId: "sl_contato",
      },
      item("it_06", "sl_pescoco", 10),
      item("it_07", "sl_institucional", 6),
      item("it_08", "sl_labial", 10),
      item("it_09", "sl_microvasos_destaque", 10),
      {
        id: "it_10",
        kind: "campaign",
        label: "Campanha ou chamada para contato",
        durationSec: 8,
        hidden: false,
        campaignIds: [],
        fallbackSlideId: "sl_contato",
      },
      item("it_11", "sl_microvasos", 10),
      item("it_12", "sl_encerramento", 8),
    ],
  },
  {
    id: "pl_institucional",
    name: "Institucional padrão",
    description: "Usada automaticamente quando a programação principal não tem peças exibíveis.",
    items: [
      item("it_i1", "sl_abertura", 5),
      item("it_i2", "sl_editorial", 7),
      item("it_i3", "sl_contato", 8),
      item("it_i4", "sl_encerramento", 8),
    ],
  },
];

const CAMPAIGNS = [
  {
    id: "cmp_bf_esquenta",
    name: "Esquenta Prime Black Friday",
    description:
      "Oferta: até 30% OFF em protocolos selecionados. Campanha demonstrativa — defina as datas efetivas de início e término antes de publicar.",
    status: "active",
    theme: "Black Friday",
    schedule: {},
    scope: "global",
    unitIds: [],
    items: [
      { slideId: "sl_bf_oferta" },
      { slideId: "sl_bf_nao_esperar" },
      { slideId: "sl_bf_resultados" },
      { slideId: "sl_bf_condicao" },
      { slideId: "sl_bf_quer_saber" },
    ],
    priority: 8,
    weight: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const UNITS = [
  {
    id: "un_centro",
    code: "unidade-centro",
    name: "Unidade Centro",
    orientation: "portrait",
    rotation: 0,
    overscanPercent: 0,
    playlistId: "pl_principal",
    fallbackPlaylistId: "pl_institucional",
    autoCampaignEvery: 4,
    active: true,
    notes: "Nome e código de exemplo — ajuste conforme a unidade real. WhatsApp e endereço não foram informados.",
  },
];

const SETTINGS = {
  brandName: "Prime Esthetics",
  tagline: "Estética Avançada",
  timezone: "America/Bahia",
  defaultDurationSec: 8,
  defaultTransition: "dissolve",
  transitionMs: 1400,
  resultsDisclaimer: "Resultados variam de pessoa para pessoa.",
  contact: {},
  fallback: { title: "Prime Esthetics", message: "Estética Avançada" },
  player: { pollSeconds: 60, reloadHours: 6 },
};

const version = "demo-inicial";
const store = {
  schemaVersion: 1,
  meta: { revision: 1, version, updatedAt: now, publishedAt: now },
  settings: SETTINGS,
  units: UNITS,
  playlists: PLAYLISTS,
  slides: SLIDES,
  campaigns: CAMPAIGNS,
  media: MEDIA,
  templates: [],
};
const draft = { ...store, meta: { ...store.meta, lastPublish: { version, at: now, by: "seed", revision: 1 } } };

fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "store.json"), JSON.stringify(store, null, 2) + "\n");
fs.writeFileSync(path.join(root, "data", "draft.json"), JSON.stringify(draft, null, 2) + "\n");
console.log("Dados demonstrativos gerados em data/store.json e data/draft.json");
