"use client";

import { Clapperboard, Plus, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { useSlideContext } from "@/components/admin/preview-data";
import { SlideThumb } from "@/components/admin/SlideThumb";
import { Badge, Button, cx, EmptyState, IconButton, Input, Modal, PageHeader, Segmented, Select, useFeedback } from "@/components/admin/ui";
import { slideAvailability, toTvSlide } from "@/lib/manifest";
import { SLIDE_TYPES, type SlideType } from "@/lib/schema";
import { BUILTIN_PRESETS, createSlide, SLIDE_TYPE_INFO } from "@/lib/slide-meta";

export default function PecasPage() {
  const { draft, update, mediaById, mediaUrl } = useDraft();
  const { confirm } = useFeedback();
  const router = useRouter();
  const ctx = useSlideContext();
  const [q, setQ] = useState("");
  const [type, setType] = useState<SlideType | "">("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [creating, setCreating] = useState(false);

  const used = useMemo(() => {
    const set = new Set<string>();
    for (const p of draft.playlists) for (const i of p.items) set.add(i.kind === "slide" ? i.slideId : (i.fallbackSlideId ?? ""));
    for (const c of draft.campaigns) for (const i of c.items) set.add(i.slideId);
    return set;
  }, [draft]);

  const list = draft.slides.filter(
    (s) => s.status === status && (!type || s.type === type) && s.name.toLowerCase().includes(q.toLowerCase()),
  );

  const create = (presetIndex: number | null, templateId?: string) => {
    let slide;
    if (templateId) {
      const t = draft.templates.find((x) => x.id === templateId)!;
      slide = createSlide(t.slide.type, {
        name: t.name,
        durationSec: t.slide.durationSec,
        transition: t.slide.transition,
        data: structuredClone(t.slide.data) as never,
      });
    } else {
      const p = BUILTIN_PRESETS[presetIndex ?? 0];
      slide = createSlide(p.type, {
        name: p.name,
        durationSec: p.durationSec,
        transition: p.transition,
        data: structuredClone(p.data) as never,
      });
    }
    update((d) => {
      d.slides.unshift(slide);
    });
    setCreating(false);
    router.push(`/admin/pecas/${slide.id}`);
  };

  const removeTemplate = async (id: string) => {
    if (!(await confirm({ title: "Excluir modelo?", confirmLabel: "Excluir", danger: true }))) return;
    update((d) => {
      d.templates = d.templates.filter((t) => t.id !== id);
    });
  };

  return (
    <>
      <PageHeader
        title="Peças"
        description="Conteúdos que podem entrar na programação e nas campanhas. Crie a partir de modelos visuais da marca — sem Photoshop ou Canva."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Nova peça
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input placeholder="Buscar peça…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={type} onChange={(e) => setType(e.target.value as SlideType | "")} className="w-56">
          <option value="">Todos os tipos</option>
          {SLIDE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SLIDE_TYPE_INFO[t].letter} · {SLIDE_TYPE_INFO[t].label}
            </option>
          ))}
        </Select>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Ativas" },
            { value: "archived", label: "Arquivadas" },
          ]}
        />
        <span className="ml-auto text-[13px] text-sand-500">{list.length} peça(s)</span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Nenhuma peça encontrada"
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Nova peça
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {list.map((s) => {
            const av = slideAvailability(s, mediaById);
            return (
              <Link key={s.id} href={`/admin/pecas/${s.id}`} className="group">
                <div className="relative">
                  <SlideThumb
                    slide={toTvSlide(s, mediaById, mediaUrl, true)}
                    ctx={ctx}
                    className="rounded-xl shadow-sm ring-1 ring-black/5 transition group-hover:ring-2 group-hover:ring-brand-400"
                  />
                  {!av.ok && (
                    <span className="absolute inset-x-2 bottom-2 flex items-start gap-1 rounded-md bg-amber-100/95 px-2 py-1 text-[10.5px] leading-snug font-medium text-amber-900">
                      <ShieldAlert className="mt-px size-3 shrink-0" /> {av.reasons[0]}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-semibold text-sand-900">{s.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge>{SLIDE_TYPE_INFO[s.type].label}</Badge>
                  <Badge tone={used.has(s.id) ? "green" : "neutral"}>{used.has(s.id) ? "Em uso" : "Sem uso"}</Badge>
                  <Badge tone="neutral">{s.durationSec}s</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova peça"
        description="Escolha um modelo visual. Você poderá editar textos, imagens, tema e tempo."
        size="lg"
      >
        {draft.templates.length > 0 && (
          <>
            <h3 className="mb-2 text-[13px] font-semibold text-sand-800">Modelos salvos</h3>
            <div className="mb-6 grid gap-2 sm:grid-cols-2">
              {draft.templates.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border border-sand-200 p-2 pl-3">
                  <Sparkles className="size-4 text-gold-500" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => create(null, t.id)}>
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-sand-500">{SLIDE_TYPE_INFO[t.slide.type].label}</span>
                  </button>
                  <IconButton icon={Trash2} label="Excluir modelo" tone="danger" onClick={() => void removeTemplate(t.id)} />
                </div>
              ))}
            </div>
          </>
        )}
        <h3 className="mb-2 text-[13px] font-semibold text-sand-800">Modelos Prime Esthetics</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUILTIN_PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => create(i)}
              className={cx(
                "flex items-start gap-3 rounded-xl border border-sand-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40",
              )}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-display text-lg text-brand-600">
                {SLIDE_TYPE_INFO[p.type].letter}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-sand-900">{p.name}</span>
                <span className="block text-xs leading-relaxed text-sand-500">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
