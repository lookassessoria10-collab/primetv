"use client";

import { Clapperboard, ImagePlus, Megaphone, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { mediaBlockReason, MEDIA_BLOCK_LABEL, toTvSlide } from "@/lib/manifest";
import type { Media, Slide } from "@/lib/schema";
import { BUILTIN_PRESETS, createSlide, MEDIA_CATEGORY_LABEL, SLIDE_TYPE_INFO } from "@/lib/slide-meta";
import { useDraft } from "./DraftProvider";
import { useSlideContext } from "./preview-data";
import { SlideThumb } from "./SlideThumb";
import { Badge, Button, cx, Input, Modal, Segmented } from "./ui";

export type AddChoice = { kind: "slide"; slideId: string } | { kind: "newSlide"; slide: Slide; edit: boolean } | { kind: "campaign" };

/** Escolha do que entra na programação: peça existente, imagem da biblioteca, novo modelo ou espaço de campanha. */
export function AddItemDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: AddChoice) => void }) {
  const [tab, setTab] = useState<"pecas" | "midias" | "modelos" | "campanha">("pecas");
  return (
    <Modal open={open} onClose={onClose} title="Adicionar à programação" size="xl">
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "pecas", label: "Peças", icon: Clapperboard },
            { value: "midias", label: "Imagem da biblioteca", icon: ImagePlus },
            { value: "modelos", label: "Novo a partir de modelo", icon: Sparkles },
            { value: "campanha", label: "Espaço de campanha", icon: Megaphone },
          ]}
        />
      </div>
      {open && tab === "pecas" && <SlidesTab onAdd={onAdd} />}
      {open && tab === "midias" && <MediaTab onAdd={onAdd} />}
      {open && tab === "modelos" && <PresetsTab onAdd={onAdd} />}
      {open && tab === "campanha" && (
        <div className="max-w-xl space-y-3 text-sm leading-relaxed text-sand-700">
          <p>
            Um <strong>espaço de campanha</strong> é preenchido automaticamente pelas campanhas ativas da unidade, alternando as peças a
            cada ciclo. Quando nenhuma campanha estiver ativa, mostra uma peça substituta (por exemplo, a chamada para contato) ou é pulado.
          </p>
          <Button variant="primary" icon={Plus} onClick={() => onAdd({ kind: "campaign" })}>
            Adicionar espaço de campanha
          </Button>
        </div>
      )}
    </Modal>
  );
}

function SlidesTab({ onAdd }: { onAdd: (c: AddChoice) => void }) {
  const { draft, mediaById, mediaUrl } = useDraft();
  const ctx = useSlideContext();
  const [q, setQ] = useState("");
  const slides = draft.slides.filter((s) => s.status === "active" && s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Input placeholder="Buscar peça…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {slides.map((s) => (
          <button key={s.id} type="button" onClick={() => onAdd({ kind: "slide", slideId: s.id })} className="group text-left">
            <SlideThumb
              slide={toTvSlide(s, mediaById, mediaUrl, true)}
              ctx={ctx}
              className="rounded-lg ring-2 ring-transparent transition group-hover:ring-brand-400"
            />
            <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium text-sand-800">{s.name}</p>
            <p className="text-[11px] text-sand-500">{SLIDE_TYPE_INFO[s.type].label}</p>
          </button>
        ))}
      </div>
      {slides.length === 0 && <p className="text-sm text-sand-500">Nenhuma peça encontrada.</p>}
    </>
  );
}

function MediaTab({ onAdd }: { onAdd: (c: AddChoice) => void }) {
  const { draft, mediaUrl } = useDraft();
  const [q, setQ] = useState("");
  const media = useMemo(
    () => draft.media.filter((m) => m.status === "active" && m.kind === "image" && m.name.toLowerCase().includes(q.toLowerCase())),
    [draft.media, q],
  );
  const add = (m: Media) => {
    const slide = createSlide("art", {
      name: m.name,
      durationSec: 10,
      data: { mediaId: m.id, showDisclaimer: m.category === "resultado" },
    });
    onAdd({ kind: "newSlide", slide, edit: false });
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Buscar imagem…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Link href="/admin/midias" className="text-sm font-medium text-brand-600 hover:underline">
          Enviar novas imagens →
        </Link>
      </div>
      <p className="mb-3 text-[13px] text-sand-500">
        A imagem entra como <strong>arte pronta</strong>, exibida inteira e sem cortes.
      </p>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {media.map((m) => {
          const blocked = mediaBlockReason(m);
          return (
            <button key={m.id} type="button" onClick={() => add(m)} className="group text-left">
              <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-sand-200 ring-2 ring-transparent transition group-hover:ring-brand-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(m)} alt="" loading="lazy" className="size-full object-contain" />
                {blocked && (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-amber-100/95 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-900">
                    {MEDIA_BLOCK_LABEL[blocked]}
                  </span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium text-sand-800">{m.name}</p>
              <p className="text-[11px] text-sand-500">{MEDIA_CATEGORY_LABEL[m.category]}</p>
            </button>
          );
        })}
      </div>
      {media.length === 0 && <p className="text-sm text-sand-500">Nenhuma imagem ativa na biblioteca.</p>}
    </>
  );
}

function PresetsTab({ onAdd }: { onAdd: (c: AddChoice) => void }) {
  const { draft } = useDraft();
  return (
    <div className="space-y-6">
      {draft.templates.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-sand-800">Modelos salvos</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draft.templates.map((t) => (
              <PresetButton
                key={t.id}
                title={t.name}
                subtitle={SLIDE_TYPE_INFO[t.slide.type].label}
                onClick={() =>
                  onAdd({
                    kind: "newSlide",
                    edit: true,
                    slide: createSlide(t.slide.type, {
                      name: t.name,
                      durationSec: t.slide.durationSec,
                      transition: t.slide.transition,
                      data: structuredClone(t.slide.data),
                    }),
                  })
                }
              />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-sand-800">Modelos Prime Esthetics</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BUILTIN_PRESETS.map((p) => (
            <PresetButton
              key={p.id}
              title={p.name}
              subtitle={p.description}
              letter={SLIDE_TYPE_INFO[p.type].letter}
              onClick={() =>
                onAdd({
                  kind: "newSlide",
                  edit: true,
                  slide: createSlide(p.type, {
                    name: p.name,
                    durationSec: p.durationSec,
                    transition: p.transition,
                    data: structuredClone(p.data) as never,
                  }),
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PresetButton({ title, subtitle, letter, onClick }: { title: string; subtitle: string; letter?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-start gap-3 rounded-xl border border-sand-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-display text-lg text-brand-600">
        {letter ?? "★"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-sand-900">{title}</span>
        <span className="block text-xs leading-relaxed text-sand-500">{subtitle}</span>
      </span>
      <Badge className="ml-auto" tone="brand">
        Usar
      </Badge>
    </button>
  );
}
