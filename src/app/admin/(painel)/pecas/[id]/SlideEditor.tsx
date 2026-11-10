"use client";

import { Archive, ArchiveRestore, ArrowLeft, BookmarkPlus, Copy, Monitor, RotateCcw, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { useSlideContext, useTvSlide } from "@/components/admin/preview-data";
import { SlideForm } from "@/components/admin/SlideForms";
import { SlideThumb } from "@/components/admin/SlideThumb";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  NumberInput,
  PageHeader,
  Segmented,
  Select,
  Textarea,
  useFeedback,
} from "@/components/admin/ui";
import { slideAvailability } from "@/lib/manifest";
import { TRANSITIONS, type Orientation, type Slide, type Transition } from "@/lib/schema";
import { newId, SLIDE_TYPE_INFO, TRANSITION_LABEL } from "@/lib/slide-meta";

export function SlideEditor({ id }: { id: string }) {
  const { draft, update, mediaById } = useDraft();
  const { toast, confirm } = useFeedback();
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get("voltar") || "/admin/pecas";
  const slide = draft.slides.find((s) => s.id === id);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [unitId, setUnitId] = useState(draft.units.find((u) => u.active)?.id ?? draft.units[0]?.id);
  const [replay, setReplay] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const unit = draft.units.find((u) => u.id === unitId);
  const ctx = useSlideContext(unit);
  const tvSlide = useTvSlide(slide);

  const usage = useMemo(() => {
    if (!slide) return [];
    const out: string[] = [];
    for (const p of draft.playlists) {
      const n = p.items.filter(
        (i) => (i.kind === "slide" && i.slideId === slide.id) || (i.kind === "campaign" && i.fallbackSlideId === slide.id),
      ).length;
      if (n) out.push(`${p.name}${n > 1 ? ` (${n}×)` : ""}`);
    }
    for (const c of draft.campaigns) if (c.items.some((i) => i.slideId === slide.id)) out.push(`Campanha: ${c.name}`);
    return out;
  }, [draft, slide]);

  if (!slide || !tvSlide) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Peça não encontrada"
        action={
          <Link href="/admin/pecas">
            <Button>Voltar para Peças</Button>
          </Link>
        }
      >
        Ela pode ter sido excluída.
      </EmptyState>
    );
  }

  const availability = slideAvailability(slide, mediaById);
  const patchSlide = (fn: (s: Slide) => void) =>
    update((d) => {
      const s = d.slides.find((x) => x.id === id);
      if (s) {
        fn(s);
        s.updatedAt = new Date().toISOString();
      }
    });
  const patchData = (p: Record<string, unknown>) => patchSlide((s) => Object.assign(s.data, p));

  const duplicate = () => {
    const copyId = newId("sl");
    update((d) => {
      const s = d.slides.find((x) => x.id === id)!;
      const now = new Date().toISOString();
      d.slides.unshift({ ...structuredClone(s), id: copyId, name: `${s.name} (cópia)`, createdAt: now, updatedAt: now });
    });
    toast("Peça duplicada.");
    router.push(`/admin/pecas/${copyId}`);
  };

  const remove = async () => {
    if (usage.length) return;
    const ok = await confirm({
      title: "Excluir peça?",
      message: `"${slide.name}" será removida do rascunho. Esta ação vale após salvar/publicar.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    update((d) => {
      d.slides = d.slides.filter((s) => s.id !== id);
    });
    router.push("/admin/pecas");
  };

  const saveTemplate = () => {
    update((d) => {
      const s = d.slides.find((x) => x.id === id)!;
      d.templates.push({
        id: newId("tpl"),
        name: templateName.trim() || s.name,
        createdAt: new Date().toISOString(),
        slide: { type: s.type, durationSec: s.durationSec, transition: s.transition, data: structuredClone(s.data) } as never,
      });
    });
    setTemplateOpen(false);
    toast("Modelo salvo. Ele aparece em “Adicionar → Novo a partir de modelo”.");
  };

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-sand-500 hover:text-brand-600">
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>
      <PageHeader
        title={slide.name || "Peça sem nome"}
        description={`${SLIDE_TYPE_INFO[slide.type].label} — ${SLIDE_TYPE_INFO[slide.type].description}`}
        actions={
          <>
            <Button icon={BookmarkPlus} onClick={() => (setTemplateName(slide.name), setTemplateOpen(true))}>
              Salvar como modelo
            </Button>
            <Button icon={Copy} onClick={duplicate}>
              Duplicar
            </Button>
            {slide.status === "active" ? (
              <Button icon={Archive} onClick={() => patchSlide((s) => (s.status = "archived"))}>
                Arquivar
              </Button>
            ) : (
              <Button icon={ArchiveRestore} onClick={() => patchSlide((s) => (s.status = "active"))}>
                Restaurar
              </Button>
            )}
            <Button
              variant="danger"
              icon={Trash2}
              disabled={usage.length > 0}
              title={usage.length ? "Remova a peça da programação e das campanhas antes de excluir" : undefined}
              onClick={remove}
            >
              Excluir
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        <div className="space-y-6">
          <Card title="Informações gerais">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_200px]">
              <Field label="Nome interno">
                <Input value={slide.name} maxLength={120} onChange={(e) => patchSlide((s) => (s.name = e.target.value))} />
              </Field>
              <Field label="Tempo de exibição">
                <NumberInput
                  value={slide.durationSec}
                  min={2}
                  max={600}
                  suffix="s"
                  onChange={(v) => v && patchSlide((s) => (s.durationSec = v))}
                />
              </Field>
              <Field label="Transição de entrada">
                <Select value={slide.transition} onChange={(e) => patchSlide((s) => (s.transition = e.target.value as Transition))}>
                  {TRANSITIONS.map((t) => (
                    <option key={t} value={t}>
                      {TRANSITION_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Observações internas" className="mt-4">
              <Textarea
                rows={2}
                value={slide.notes ?? ""}
                maxLength={1000}
                onChange={(e) => patchSlide((s) => (s.notes = e.target.value || undefined))}
              />
            </Field>
            <p className="mt-3 text-xs text-sand-500">
              {usage.length ? `Usada em: ${usage.join(" · ")}` : "Ainda não está em nenhuma programação ou campanha."}
            </p>
          </Card>
          <Card title="Conteúdo">
            <SlideForm slide={slide} patch={patchData} />
          </Card>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card
            title="Pré-visualização"
            actions={
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setReplay((n) => n + 1)}>
                Repetir animação
              </Button>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                value={orientation}
                onChange={setOrientation}
                options={[
                  { value: "portrait", label: "Vertical", icon: Smartphone },
                  { value: "landscape", label: "Horizontal", icon: Monitor },
                ]}
              />
              {draft.units.length > 1 && (
                <select
                  className="h-8 rounded-lg border border-sand-300 bg-white px-2 text-xs"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  aria-label="Unidade da prévia"
                >
                  {draft.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className={orientation === "portrait" ? "mx-auto max-w-[340px]" : ""}>
              <SlideThumb slide={tvSlide} ctx={ctx} orientation={orientation} animate replayKey={replay} className="rounded-lg shadow-lg" />
            </div>
            <div className="mt-3 space-y-2">
              {!availability.ok ? (
                <Notice tone="amber" icon={ShieldAlert} title="Esta peça não será exibida na TV">
                  {availability.reasons.join("; ")}.
                </Notice>
              ) : (
                <Badge tone="green">Pronta para exibição</Badge>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Salvar como modelo"
        size="sm"
        footer={
          <>
            <Button onClick={() => setTemplateOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveTemplate}>
              Salvar modelo
            </Button>
          </>
        }
      >
        <Field label="Nome do modelo" hint="O modelo guarda layout, textos, tema e imagens desta peça para reutilizar em novas peças.">
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}
