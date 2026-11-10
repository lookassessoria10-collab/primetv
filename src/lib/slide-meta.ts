import type { MediaCategory, Slide, SlideData, SlideType, Theme, Transition } from "./schema";

export const SLIDE_TYPE_INFO: Record<SlideType, { label: string; letter: string; description: string }> = {
  art: { label: "Arte pronta", letter: "A", description: "Imagem completa, exibida inteira e sem cortes." },
  beforeAfter: {
    label: "Antes e depois",
    letter: "B",
    description: "Procedimento com duas fotografias comparativas ou peça já diagramada.",
  },
  promo: { label: "Campanha promocional", letter: "C", description: "Título, percentual de desconto e chamada para contato." },
  procedure: { label: "Destaque de procedimento", letter: "D", description: "Foto de apoio, nome do procedimento e convite à avaliação." },
  institutional: { label: "Institucional", letter: "E", description: "Abertura, mensagem sobre a clínica ou encerramento." },
  cta: { label: "Chamada para ação", letter: "F", description: "WhatsApp e QR Code gerados a partir do contato real da unidade." },
  video: { label: "Vídeo", letter: "G", description: "Vídeo curto em reprodução silenciosa, com imagem de substituição." },
};

export const TRANSITION_LABEL: Record<Transition, string> = {
  dissolve: "Dissolução",
  fade: "Fade suave",
  zoom: "Zoom fotográfico",
  rise: "Movimento sutil",
  mask: "Máscara orgânica",
};

export const THEME_INFO: Record<Theme, { label: string; swatch: string }> = {
  creme: { label: "Creme", swatch: "linear-gradient(135deg,#f8eee5,#ead6c4)" },
  rose: { label: "Rosé", swatch: "linear-gradient(135deg,#cdb0a3,#ad8b7e)" },
  terracota: { label: "Terracota", swatch: "linear-gradient(135deg,#bd6a43,#873d24)" },
  chocolate: { label: "Chocolate", swatch: "linear-gradient(135deg,#4f2918,#1f0e07)" },
};

export const MEDIA_CATEGORY_LABEL: Record<MediaCategory, string> = {
  resultado: "Resultado clínico",
  arte: "Arte pronta",
  campanha: "Campanha",
  procedimento: "Procedimento",
  institucional: "Institucional",
  ambiente: "Ambiente",
  marca: "Marca",
  outro: "Outro",
};

export function defaultSlideData<T extends SlideType>(type: T): SlideData<T> {
  const data: { [K in SlideType]: SlideData<K> } = {
    art: { background: "brand", kenBurns: false, showDisclaimer: false },
    beforeAfter: {
      source: "photos",
      layout: "vertical",
      eyebrow: "Procedimento",
      title: "Nome do procedimento",
      beforeLabel: "Antes",
      afterLabel: "Depois",
      showDisclaimer: true,
      theme: "rose",
    },
    promo: {
      eyebrow: "Nome da campanha",
      headline: "Mensagem principal da *campanha*",
      highlightPrefix: "Até",
      highlight: "",
      highlightSuffix: "OFF",
      highlightDetail: "em protocolos selecionados",
      text: "",
      cta: "Converse com nossa equipe",
      footnote: "Consulte as condições com nossa equipe.",
      theme: "chocolate",
    },
    procedure: {
      eyebrow: "Procedimento",
      title: "Nome do procedimento",
      text: "Texto curto sobre o procedimento.",
      cta: "Agende sua avaliação",
      theme: "creme",
    },
    institutional: {
      variant: "message",
      eyebrow: "",
      title: "Cuidado estético começa com uma *boa avaliação*.",
      text: "",
      cta: "",
      theme: "terracota",
      showLogo: true,
    },
    cta: {
      eyebrow: "Fale com a Prime",
      title: "O seu próximo cuidado pode começar *hoje*.",
      text: "Converse com nossa equipe e agende sua avaliação.",
      showWhatsapp: true,
      showQr: true,
      qrTarget: "whatsapp",
      qrLabel: "Aponte a câmera do celular",
      theme: "chocolate",
    },
    video: {},
  };
  return structuredClone(data[type]) as SlideData<T>;
}

export function newId(prefix: string): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}_${s}`;
}

export function createSlide<T extends SlideType>(
  type: T,
  init: { name?: string; durationSec?: number; transition?: Transition; data?: Partial<SlideData<T>> } = {},
): Slide {
  const now = new Date().toISOString();
  return {
    id: newId("sl"),
    type,
    name: init.name || SLIDE_TYPE_INFO[type].label,
    durationSec: init.durationSec ?? (type === "beforeAfter" || type === "art" ? 10 : 8),
    transition: init.transition ?? (type === "art" ? "dissolve" : "rise"),
    status: "active",
    createdAt: now,
    updatedAt: now,
    data: { ...defaultSlideData(type), ...(init.data || {}) },
  } as Slide;
}

export interface BuiltinPreset {
  id: string;
  name: string;
  description: string;
  type: SlideType;
  durationSec: number;
  transition: Transition;
  data: Partial<SlideData<SlideType>>;
}

/** Modelos visuais predefinidos (layouts consistentes com a identidade). */
export const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    id: "p-art",
    name: "Arte pronta",
    description: "Envie uma arte finalizada (1080×1920).",
    type: "art",
    durationSec: 10,
    transition: "dissolve",
    data: {},
  },
  {
    id: "p-ba-vertical",
    name: "Antes e depois — vertical",
    description: "Duas fotos empilhadas, como nas artes atuais.",
    type: "beforeAfter",
    durationSec: 10,
    transition: "dissolve",
    data: { layout: "vertical", theme: "rose" },
  },
  {
    id: "p-ba-side",
    name: "Antes e depois — lado a lado",
    description: "Duas fotos lado a lado.",
    type: "beforeAfter",
    durationSec: 10,
    transition: "dissolve",
    data: { layout: "sideBySide", theme: "creme" },
  },
  {
    id: "p-ba-composed",
    name: "Antes e depois — peça diagramada",
    description: "Use uma arte comparativa já pronta.",
    type: "beforeAfter",
    durationSec: 10,
    transition: "dissolve",
    data: { source: "composed" },
  },
  {
    id: "p-promo",
    name: "Campanha com desconto",
    description: "Percentual em destaque e chamada para contato.",
    type: "promo",
    durationSec: 8,
    transition: "zoom",
    data: {},
  },
  {
    id: "p-procedure",
    name: "Destaque de procedimento",
    description: "Foto em arco, nome e texto curto.",
    type: "procedure",
    durationSec: 8,
    transition: "zoom",
    data: {},
  },
  {
    id: "p-opening",
    name: "Abertura institucional",
    description: "Símbolo e logotipo Prime Esthetics.",
    type: "institutional",
    durationSec: 5,
    transition: "fade",
    data: { variant: "opening", title: "", theme: "chocolate" },
  },
  {
    id: "p-message",
    name: "Mensagem editorial",
    description: "Frase curta sobre cuidado estético.",
    type: "institutional",
    durationSec: 7,
    transition: "rise",
    data: {
      variant: "message",
      theme: "creme",
      title: "Seu rosto tem características *únicas*.",
      text: "Seu tratamento também deve considerar isso.",
    },
  },
  {
    id: "p-closing",
    name: "Encerramento com convite",
    description: "Mensagem final e convite à avaliação.",
    type: "institutional",
    durationSec: 8,
    transition: "mask",
    data: { variant: "closing", theme: "terracota", cta: "Agende sua avaliação" },
  },
  {
    id: "p-cta",
    name: "Chamada para WhatsApp",
    description: "Número e QR Code da unidade.",
    type: "cta",
    durationSec: 8,
    transition: "rise",
    data: {},
  },
  {
    id: "p-video",
    name: "Vídeo curto",
    description: "MP4/WebM silencioso, até 4 MB.",
    type: "video",
    durationSec: 12,
    transition: "dissolve",
    data: {},
  },
];
