"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { THEMES, type Slide, type SlideData, type SlideType, type Theme } from "@/lib/schema";
import { THEME_INFO } from "@/lib/slide-meta";
import { useDraft } from "./DraftProvider";
import { MediaPicker } from "./MediaPicker";
import { cx, Field, Input, Notice, Segmented, Switch, Textarea } from "./ui";

type Patch<T extends SlideType> = (patch: Partial<SlideData<T>>) => void;

const EMPHASIS_HINT = "Use *asteriscos* para destacar palavras em itálico dourado. Enter cria uma nova linha.";

function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <Field label="Tema de cores">
      <div className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={value === t}
            className={cx(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition",
              value === t ? "border-brand-400 bg-brand-50 text-brand-700" : "border-sand-200 bg-white text-sand-700 hover:border-sand-300",
            )}
          >
            <span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: THEME_INFO[t].swatch }} />
            {THEME_INFO[t].label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  rows,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  rows?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      hint={hint}
      aside={
        max ? (
          <span className="text-[11px] text-sand-400 tabular-nums">
            {value.length}/{max}
          </span>
        ) : undefined
      }
    >
      {rows ? (
        <Textarea rows={rows} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SlideForm({ slide, patch }: { slide: Slide; patch: (p: Record<string, unknown>) => void }) {
  switch (slide.type) {
    case "art":
      return <ArtForm d={slide.data} patch={patch as Patch<"art">} />;
    case "beforeAfter":
      return <BeforeAfterForm d={slide.data} patch={patch as Patch<"beforeAfter">} />;
    case "promo":
      return <PromoForm d={slide.data} patch={patch as Patch<"promo">} />;
    case "procedure":
      return <ProcedureForm d={slide.data} patch={patch as Patch<"procedure">} />;
    case "institutional":
      return <InstitutionalForm d={slide.data} patch={patch as Patch<"institutional">} />;
    case "cta":
      return <CtaForm d={slide.data} patch={patch as Patch<"cta">} />;
    case "video":
      return <VideoForm d={slide.data} patch={patch as Patch<"video">} />;
  }
}

function ArtForm({ d, patch }: { d: SlideData<"art">; patch: Patch<"art"> }) {
  const { mediaById } = useDraft();
  const media = d.mediaId ? mediaById.get(d.mediaId) : undefined;
  return (
    <div className="space-y-5">
      <MediaPicker label="Arte" value={d.mediaId} onChange={(id) => patch({ mediaId: id })} uploadCategory="arte" />
      <Notice tone="neutral" icon={Info}>
        A arte é sempre exibida inteira, sem esticar nem cortar. Em TVs horizontais, as laterais recebem um fundo da marca.
      </Notice>
      <Field label="Fundo nas laterais (TV horizontal)">
        <Segmented
          value={d.background}
          onChange={(v) => patch({ background: v })}
          options={[
            { value: "brand", label: "Identidade Prime" },
            { value: "blur", label: "Arte desfocada" },
          ]}
        />
      </Field>
      <Switch
        checked={d.showDisclaimer}
        onChange={(v) => patch({ showDisclaimer: v })}
        label="Exibir observação sobre resultados"
        description="Reduz levemente a arte e mostra a observação configurada (ex.: “Resultados variam de pessoa para pessoa”)."
      />
      <Switch
        checked={d.kenBurns}
        disabled={media?.hasText}
        onChange={(v) => patch({ kenBurns: v })}
        label="Zoom fotográfico lento"
        description={
          media?.hasText ? "Indisponível para artes com texto (evita cortar informações)." : "Somente para fotografias sem texto."
        }
      />
    </div>
  );
}

function BeforeAfterForm({ d, patch }: { d: SlideData<"beforeAfter">; patch: Patch<"beforeAfter"> }) {
  return (
    <div className="space-y-5">
      <Field label="Origem das imagens">
        <Segmented
          value={d.source}
          onChange={(v) => patch({ source: v })}
          options={[
            { value: "photos", label: "Duas fotografias" },
            { value: "composed", label: "Peça já diagramada" },
          ]}
        />
      </Field>
      <Notice tone="amber" icon={Info}>
        Use fotografias reais e sem retoques nos resultados. Fotos de pacientes só aparecem na TV com autorização registrada na mídia.
      </Notice>
      {d.source === "composed" ? (
        <MediaPicker
          label="Peça de antes e depois"
          value={d.composedMediaId}
          onChange={(id) => patch({ composedMediaId: id })}
          uploadCategory="resultado"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <MediaPicker
              label="Foto antes"
              value={d.beforeMediaId}
              onChange={(id) => patch({ beforeMediaId: id })}
              uploadCategory="resultado"
            />
            <MediaPicker
              label="Foto depois"
              value={d.afterMediaId}
              onChange={(id) => patch({ afterMediaId: id })}
              uploadCategory="resultado"
            />
          </div>
          <Field label="Comparação">
            <Segmented
              value={d.layout}
              onChange={(v) => patch({ layout: v })}
              options={[
                { value: "vertical", label: "Vertical (uma sobre a outra)" },
                { value: "sideBySide", label: "Lado a lado" },
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Sobretítulo" value={d.eyebrow} max={60} onChange={(v) => patch({ eyebrow: v })} />
            <Text label="Título do procedimento" value={d.title} max={120} onChange={(v) => patch({ title: v })} hint={EMPHASIS_HINT} />
            <Text label="Rótulo antes" value={d.beforeLabel} max={30} onChange={(v) => patch({ beforeLabel: v })} />
            <Text label="Rótulo depois" value={d.afterLabel} max={30} onChange={(v) => patch({ afterLabel: v })} />
          </div>
          <ThemePicker value={d.theme} onChange={(t) => patch({ theme: t })} />
        </>
      )}
      <Switch
        checked={d.showDisclaimer}
        onChange={(v) => patch({ showDisclaimer: v })}
        label="Exibir observação sobre individualidade dos resultados"
      />
      {d.showDisclaimer && d.source === "photos" && (
        <Text
          label="Observação (opcional)"
          value={d.disclaimer ?? ""}
          max={240}
          onChange={(v) => patch({ disclaimer: v || undefined })}
          placeholder="Vazio = texto padrão das configurações"
        />
      )}
    </div>
  );
}

function PromoForm({ d, patch }: { d: SlideData<"promo">; patch: Patch<"promo"> }) {
  return (
    <div className="space-y-5">
      <Text
        label="Campanha (sobretítulo)"
        value={d.eyebrow}
        max={80}
        onChange={(v) => patch({ eyebrow: v })}
        placeholder="Ex.: Esquenta Prime Black Friday"
      />
      <Text
        label="Mensagem principal"
        value={d.headline}
        max={160}
        rows={2}
        onChange={(v) => patch({ headline: v })}
        hint={EMPHASIS_HINT}
      />
      <Field label="Destaque da oferta" hint="Preencha apenas com condições reais aprovadas. Deixe o valor vazio para ocultar o quadro.">
        <div className="grid grid-cols-[90px_110px_90px] gap-2">
          <Input
            value={d.highlightPrefix}
            maxLength={20}
            onChange={(e) => patch({ highlightPrefix: e.target.value })}
            placeholder="Até"
            aria-label="Prefixo"
          />
          <Input
            value={d.highlight}
            maxLength={20}
            onChange={(e) => patch({ highlight: e.target.value })}
            placeholder="30%"
            aria-label="Valor"
          />
          <Input
            value={d.highlightSuffix}
            maxLength={20}
            onChange={(e) => patch({ highlightSuffix: e.target.value })}
            placeholder="OFF"
            aria-label="Sufixo"
          />
        </div>
      </Field>
      <Text
        label="Complemento da oferta"
        value={d.highlightDetail}
        max={120}
        onChange={(v) => patch({ highlightDetail: v })}
        placeholder="em protocolos selecionados"
      />
      <Text label="Texto adicional" value={d.text} max={240} rows={2} onChange={(v) => patch({ text: v })} />
      <Text label="Chamada para contato" value={d.cta} max={120} onChange={(v) => patch({ cta: v })} />
      <Text
        label="Rodapé"
        value={d.footnote}
        max={200}
        onChange={(v) => patch({ footnote: v })}
        placeholder="Ex.: Consulte as condições com nossa equipe."
      />
      <MediaPicker
        label="Fotografia de fundo"
        optional
        value={d.mediaId}
        onChange={(id) => patch({ mediaId: id })}
        uploadCategory="campanha"
      />
      <ThemePicker value={d.theme} onChange={(t) => patch({ theme: t })} />
    </div>
  );
}

function ProcedureForm({ d, patch }: { d: SlideData<"procedure">; patch: Patch<"procedure"> }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Sobretítulo" value={d.eyebrow} max={60} onChange={(v) => patch({ eyebrow: v })} />
        <Text label="Nome do procedimento" value={d.title} max={120} onChange={(v) => patch({ title: v })} />
      </div>
      <Text
        label="Texto explicativo curto"
        value={d.text}
        max={280}
        rows={3}
        onChange={(v) => patch({ text: v })}
        hint="Sem promessas de resultado. Ex.: “Equilíbrio, proporção e avaliação individual.”"
      />
      <Text label="Convite" value={d.cta} max={120} onChange={(v) => patch({ cta: v })} placeholder="Agende sua avaliação" />
      <MediaPicker
        label="Fotografia de apoio"
        optional
        value={d.mediaId}
        onChange={(id) => patch({ mediaId: id })}
        uploadCategory="procedimento"
      />
      <ThemePicker value={d.theme} onChange={(t) => patch({ theme: t })} />
    </div>
  );
}

function InstitutionalForm({ d, patch }: { d: SlideData<"institutional">; patch: Patch<"institutional"> }) {
  return (
    <div className="space-y-5">
      <Field label="Formato">
        <Segmented
          value={d.variant}
          onChange={(v) => patch({ variant: v })}
          options={[
            { value: "opening", label: "Abertura" },
            { value: "message", label: "Mensagem" },
            { value: "closing", label: "Encerramento" },
          ]}
        />
      </Field>
      <Text label="Sobretítulo" value={d.eyebrow} max={80} onChange={(v) => patch({ eyebrow: v })} />
      <Text label="Mensagem principal" value={d.title} max={200} rows={2} onChange={(v) => patch({ title: v })} hint={EMPHASIS_HINT} />
      <Text label="Texto complementar" value={d.text} max={280} rows={2} onChange={(v) => patch({ text: v })} />
      <Text label="Chamada comercial" value={d.cta} max={120} onChange={(v) => patch({ cta: v })} placeholder="Ex.: Agende sua avaliação" />
      <MediaPicker
        label="Imagem de ambiente ou atendimento"
        optional
        value={d.mediaId}
        onChange={(id) => patch({ mediaId: id })}
        uploadCategory="ambiente"
      />
      <Switch checked={d.showLogo} onChange={(v) => patch({ showLogo: v })} label="Exibir logotipo" />
      <ThemePicker value={d.theme} onChange={(t) => patch({ theme: t })} />
    </div>
  );
}

function CtaForm({ d, patch }: { d: SlideData<"cta">; patch: Patch<"cta"> }) {
  return (
    <div className="space-y-5">
      <Notice tone="blue" icon={Info}>
        O número de WhatsApp e o QR Code vêm do cadastro da unidade (ou do contato geral em Configurações). Sem número cadastrado, eles
        ficam ocultos — nunca são inventados. Configure em{" "}
        <Link href="/admin/unidades" className="font-medium underline">
          Unidades
        </Link>
        .
      </Notice>
      <Text label="Sobretítulo" value={d.eyebrow} max={80} onChange={(v) => patch({ eyebrow: v })} />
      <Text label="Mensagem principal" value={d.title} max={160} rows={2} onChange={(v) => patch({ title: v })} hint={EMPHASIS_HINT} />
      <Text
        label="Texto"
        value={d.text}
        max={240}
        rows={2}
        onChange={(v) => patch({ text: v })}
        hint="Se a unidade tiver mensagem personalizada, ela substitui este texto."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Switch checked={d.showWhatsapp} onChange={(v) => patch({ showWhatsapp: v })} label="Mostrar número do WhatsApp" />
        <Switch checked={d.showQr} onChange={(v) => patch({ showQr: v })} label="Mostrar QR Code" />
      </div>
      {d.showQr && (
        <>
          <Field label="O QR Code abre">
            <Segmented
              value={d.qrTarget}
              onChange={(v) => patch({ qrTarget: v })}
              options={[
                { value: "whatsapp", label: "Conversa no WhatsApp" },
                { value: "url", label: "Um endereço (link)" },
              ]}
            />
          </Field>
          {d.qrTarget === "url" && (
            <Text label="Endereço (https://…)" value={d.url ?? ""} max={300} onChange={(v) => patch({ url: v || undefined })} />
          )}
          <Text label="Legenda do QR Code" value={d.qrLabel} max={80} onChange={(v) => patch({ qrLabel: v })} />
        </>
      )}
      <MediaPicker
        label="Fotografia de fundo"
        optional
        value={d.mediaId}
        onChange={(id) => patch({ mediaId: id })}
        uploadCategory="institucional"
      />
      <ThemePicker value={d.theme} onChange={(t) => patch({ theme: t })} />
    </div>
  );
}

function VideoForm({ d, patch }: { d: SlideData<"video">; patch: Patch<"video"> }) {
  return (
    <div className="space-y-5">
      <Notice tone="neutral" icon={Info}>
        Os vídeos tocam sem som e em repetição durante o tempo da peça. Use MP4 (H.264) ou WebM de até 4 MB. Se não puder ser reproduzido, a
        TV mostra a imagem de substituição ou pula para a próxima peça.
      </Notice>
      <MediaPicker kind="video" label="Vídeo" value={d.mediaId} onChange={(id) => patch({ mediaId: id })} uploadCategory="institucional" />
      <MediaPicker
        label="Imagem de substituição"
        optional
        value={d.posterMediaId}
        onChange={(id) => patch({ posterMediaId: id })}
        uploadCategory="institucional"
      />
    </div>
  );
}
