"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  ListVideo,
  Megaphone,
  MonitorPlay,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useMemo, useState } from "react";
import { AddItemDialog, type AddChoice } from "@/components/admin/AddItemDialog";
import { useDraft } from "@/components/admin/DraftProvider";
import { PreviewDialog } from "@/components/admin/PreviewDialog";
import { useDraftManifest, useSlideContext, type SlideContext } from "@/components/admin/preview-data";
import { ScheduleFields } from "@/components/admin/ScheduleFields";
import { SlideThumb } from "@/components/admin/SlideThumb";
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Notice,
  NumberInput,
  PageHeader,
  Select,
  useFeedback,
} from "@/components/admin/ui";
import { buildCycle, cycleDuration, formatDuration, newRotation } from "@/lib/cycle";
import { slideAvailability, toTvSlide, type TvSlide } from "@/lib/manifest";
import { campaignAppliesToUnit, campaignPhase, describeSchedule, hasSchedule, localParts } from "@/lib/schedule";
import { TRANSITIONS, type Playlist, type PlaylistItem, type Store, type Transition } from "@/lib/schema";
import { newId, SLIDE_TYPE_INFO, TRANSITION_LABEL } from "@/lib/slide-meta";

export function ProgramacaoEditor() {
  const { draft, update } = useDraft();
  const { toast } = useFeedback();
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("unidade");
  const unit = draft.units.find((u) => u.code === code) ?? draft.units.find((u) => u.active) ?? draft.units[0];
  const playlist = draft.playlists.find((p) => p.id === unit?.playlistId);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ index: number; side: "before" | "after" } | null>(null);

  const ctx = useSlideContext(unit);
  const manifest = useDraftManifest(unit);
  const cycle = useMemo(() => (manifest ? buildCycle(manifest, new Date(), newRotation()) : []), [manifest]);

  if (!unit) {
    return (
      <>
        <PageHeader title="Programação" />
        <EmptyState
          icon={ListVideo}
          title="Nenhuma unidade cadastrada"
          action={
            <Link href="/admin/unidades">
              <Button variant="primary">Cadastrar unidade</Button>
            </Link>
          }
        >
          Cadastre a primeira unidade para montar a programação da TV.
        </EmptyState>
      </>
    );
  }

  const sharedWith = draft.units.filter((u) => u.id !== unit.id && u.playlistId === unit.playlistId);

  const editPlaylist = (fn: (p: Playlist, d: Store) => void) =>
    update((d) => {
      const p = d.playlists.find((x) => x.id === unit.playlistId);
      if (p) fn(p, d);
    });

  const move = (from: number, to: number) => {
    if (from === to) return;
    editPlaylist((p) => {
      const [it] = p.items.splice(from, 1);
      p.items.splice(to > from ? to - 1 : to, 0, it);
    });
  };

  const onAdd = (c: AddChoice) => {
    const itemId = newId("it");
    if (c.kind === "campaign") {
      editPlaylist((p) =>
        p.items.push({ id: itemId, kind: "campaign", label: "Espaço de campanha", hidden: false, campaignIds: [], durationSec: 8 }),
      );
      toast("Espaço de campanha adicionado ao final da programação.");
    } else if (c.kind === "slide") {
      editPlaylist((p) => p.items.push({ id: itemId, kind: "slide", slideId: c.slideId, hidden: false }));
      toast("Peça adicionada ao final da programação.");
    } else {
      update((d) => {
        d.slides.unshift(c.slide);
        d.playlists.find((x) => x.id === unit.playlistId)?.items.push({ id: itemId, kind: "slide", slideId: c.slide.id, hidden: false });
      });
      if (c.edit) {
        router.push(`/admin/pecas/${c.slide.id}?voltar=${encodeURIComponent(`/admin/programacao?unidade=${unit.code}`)}`);
        return;
      }
      toast("Imagem adicionada como arte pronta.");
    }
    setAdding(false);
  };

  const makeExclusive = () => {
    if (!playlist) return;
    const id = newId("pl");
    update((d) => {
      const src = d.playlists.find((p) => p.id === playlist.id)!;
      d.playlists.push({
        id,
        name: `${unit.name} — programação`,
        description: `Criada a partir de "${src.name}".`,
        items: src.items.map((it) => ({ ...structuredClone(it), id: newId("it") })),
      });
      const u = d.units.find((x) => x.id === unit.id)!;
      u.playlistId = id;
    });
    toast(`"${unit.name}" agora tem uma programação exclusiva. As alterações não afetam as demais unidades.`);
  };

  const editingItem = playlist?.items.find((i) => i.id === editing);
  const hiddenCount = playlist?.items.filter((i) => i.hidden).length ?? 0;
  const total = cycleDuration(cycle);

  return (
    <>
      <PageHeader
        title="Programação"
        description="Monte a sequência exibida na TV. Arraste as miniaturas para reordenar; durações e transições podem ser ajustadas em cada peça."
        actions={
          <>
            <Button icon={MonitorPlay} onClick={() => setPreview(true)}>
              Pré-visualizar sequência
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={!playlist}>
              Adicionar
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {draft.units.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => router.replace(`/admin/programacao?unidade=${u.code}`)}
            className={cx(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium ring-1 transition",
              u.id === unit.id ? "bg-sand-900 text-white ring-sand-900" : "bg-white text-sand-700 ring-sand-300 hover:ring-sand-400",
            )}
          >
            <span className={cx("size-1.5 rounded-full", u.active ? "bg-emerald-400" : "bg-sand-400")} />
            {u.name}
          </button>
        ))}
      </div>

      <Card className="mb-5" bodyClassName="flex flex-wrap items-end gap-4">
        <Field label="Programação desta unidade" className="w-72">
          <Select
            value={unit.playlistId}
            onChange={(e) =>
              update((d) => {
                d.units.find((x) => x.id === unit.id)!.playlistId = e.target.value;
              })
            }
          >
            {draft.playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {playlist && (
          <Field label="Nome da programação" className="w-72">
            <Input value={playlist.name} onChange={(e) => editPlaylist((p) => (p.name = e.target.value))} />
          </Field>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[13px] text-sand-600">
          <Badge tone="brand">{cycle.length} telas no ciclo atual</Badge>
          <Badge tone="neutral">Duração do ciclo: {formatDuration(total)}</Badge>
          {hiddenCount > 0 && <Badge tone="amber">{hiddenCount} oculta(s)</Badge>}
        </div>
        {sharedWith.length > 0 && (
          <div className="w-full">
            <Notice
              tone="blue"
              icon={Link2}
              title={`Esta programação também é usada por: ${sharedWith.map((u) => u.name).join(", ")}.`}
              action={
                <Button size="sm" onClick={makeExclusive}>
                  Criar programação exclusiva
                </Button>
              }
            >
              Alterações aqui aparecem em todas essas unidades.
            </Notice>
          </div>
        )}
      </Card>

      {!playlist ? (
        <EmptyState icon={ListVideo} title="Unidade sem programação">
          Selecione uma programação acima.
        </EmptyState>
      ) : (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
          onDragEnd={() => (setDragIndex(null), setDrop(null))}
        >
          {playlist.items.map((item, i) => (
            // Motion anima a troca de posição das miniaturas ao reordenar.
            <motion.div key={item.id} layout="position" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", item.id);
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setDrop({ index: i, side: e.clientX < r.left + r.width / 2 ? "before" : "after" });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && drop) move(dragIndex, drop.side === "before" ? drop.index : drop.index + 1);
                  setDragIndex(null);
                  setDrop(null);
                }}
                className={cx("relative", dragIndex === i && "opacity-40")}
              >
                {drop?.index === i && dragIndex !== null && (
                  <span
                    className={cx(
                      "absolute top-0 bottom-0 z-10 w-1 rounded bg-brand-500",
                      drop.side === "before" ? "-left-2.5" : "-right-2.5",
                    )}
                  />
                )}
                <ItemCard
                  item={item}
                  index={i}
                  count={playlist.items.length}
                  ctx={ctx}
                  unitId={unit.id}
                  onMove={move}
                  onEdit={() => setEditing(item.id)}
                />
              </div>
            </motion.div>
          ))}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sand-300 text-sm font-medium text-sand-500 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Plus className="size-6" />
            Adicionar
          </button>
        </div>
      )}

      <AddItemDialog open={adding} onClose={() => setAdding(false)} onAdd={onAdd} />
      <PreviewDialog open={preview} onClose={() => setPreview(false)} initialUnitId={unit.id} />
      <ItemSettingsDialog item={editingItem} unitId={unit.id} onClose={() => setEditing(null)} />
    </>
  );
}

const ItemCard = memo(function ItemCard({
  item,
  index,
  count,
  ctx,
  unitId,
  onMove,
  onEdit,
}: {
  item: PlaylistItem;
  index: number;
  count: number;
  ctx: SlideContext;
  unitId: string;
  onMove: (from: number, to: number) => void;
  onEdit: () => void;
}) {
  const { draft, update, mediaById, mediaUrl } = useDraft();
  const slide = item.kind === "slide" ? draft.slides.find((s) => s.id === item.slideId) : undefined;
  const tvSlide: TvSlide | null = useMemo(() => (slide ? toTvSlide(slide, mediaById, mediaUrl, true) : null), [slide, mediaById, mediaUrl]);
  const availability = slide ? slideAvailability(slide, mediaById) : null;
  const parts = localParts(new Date(), draft.settings.timezone);

  const editItem = (fn: (it: PlaylistItem) => void) =>
    update((d) => {
      for (const p of d.playlists) {
        const it = p.items.find((x) => x.id === item.id);
        if (it) fn(it);
      }
    });
  const remove = () =>
    update((d) => {
      for (const p of d.playlists) p.items = p.items.filter((x) => x.id !== item.id);
    });
  const duplicate = () =>
    update((d) => {
      for (const p of d.playlists) {
        const idx = p.items.findIndex((x) => x.id === item.id);
        if (idx >= 0) p.items.splice(idx + 1, 0, { ...structuredClone(p.items[idx]), id: newId("it") });
      }
    });

  const effectiveDuration = item.durationSec ?? slide?.durationSec ?? draft.settings.defaultDurationSec;
  const defaultTransition = slide?.transition ?? draft.settings.defaultTransition;
  const scheduled = item.kind === "slide" && (hasSchedule(item.schedule) || item.campaignId);
  const linkedCampaign = item.kind === "slide" && item.campaignId ? draft.campaigns.find((c) => c.id === item.campaignId) : undefined;

  // Campanhas que preencheriam este espaço agora
  const filling =
    item.kind === "campaign"
      ? draft.campaigns.filter(
          (c) =>
            (item.campaignIds.length === 0 || item.campaignIds.includes(c.id)) &&
            campaignAppliesToUnit(c, unitId) &&
            campaignPhase(c, parts) === "live",
        )
      : [];
  const fallback = item.kind === "campaign" && item.fallbackSlideId ? draft.slides.find((s) => s.id === item.fallbackSlideId) : undefined;
  const fallbackTv = useMemo(() => (fallback ? toTvSlide(fallback, mediaById, mediaUrl, true) : null), [fallback, mediaById, mediaUrl]);

  return (
    <div className={cx("group flex flex-col", item.hidden && "opacity-55")}>
      <div className="relative">
        <span className="absolute top-2 left-2 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/65 px-1.5 text-[11.5px] font-semibold text-white tabular-nums">
          {index + 1}
        </span>
        <span
          className="absolute top-2 right-2 z-10 cursor-grab rounded-md bg-black/45 p-1 text-white opacity-0 transition group-hover:opacity-100"
          title="Arraste para reordenar"
        >
          <GripVertical className="size-3.5" />
        </span>
        {item.kind === "slide" ? (
          <SlideThumb slide={tvSlide} ctx={ctx} className="rounded-xl shadow-sm ring-1 ring-black/5" />
        ) : (
          <div className="relative flex aspect-[9/16] flex-col overflow-hidden rounded-xl bg-[radial-gradient(120%_70%_at_30%_20%,#5a2c19,#1f0e07)] p-3 text-white shadow-sm">
            {fallbackTv && filling.length === 0 && (
              <div className="absolute inset-0 opacity-35">
                <SlideThumb slide={fallbackTv} ctx={ctx} />
              </div>
            )}
            <div className="relative mt-auto mb-auto text-center">
              <Megaphone className="mx-auto size-7 text-[#e9c37d]" />
              <p className="mt-2 font-display text-[15px] leading-tight">{item.label || "Espaço de campanha"}</p>
              <p className="mt-2 text-[11px] leading-snug text-white/75">
                {filling.length > 0
                  ? `Agora: ${filling.map((c) => c.name).join(", ")}`
                  : fallback
                    ? `Sem campanha ativa: exibe "${fallback.name}"`
                    : "Sem campanha ativa: espaço pulado"}
              </p>
            </div>
          </div>
        )}
        {item.hidden && (
          <span className="absolute inset-x-2 bottom-2 z-10 rounded-md bg-sand-900/80 px-2 py-1 text-center text-[11px] font-medium text-white">
            Oculta na TV
          </span>
        )}
        {availability && !availability.ok && !item.hidden && (
          <span className="absolute inset-x-2 bottom-2 z-10 flex items-start gap-1 rounded-md bg-amber-100/95 px-2 py-1 text-[10.5px] leading-snug font-medium text-amber-900">
            <ShieldAlert className="mt-px size-3 shrink-0" /> Não exibida: {availability.reasons.join("; ")}
          </span>
        )}
      </div>

      <div className="mt-2 min-w-0">
        <p className="truncate text-[13px] font-semibold text-sand-900" title={item.kind === "slide" ? slide?.name : item.label}>
          {item.kind === "slide" ? (slide?.name ?? "Peça removida") : item.label || "Espaço de campanha"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge tone={item.kind === "campaign" ? "violet" : "neutral"}>
            {item.kind === "campaign" ? "Campanha" : slide ? SLIDE_TYPE_INFO[slide.type].label : "—"}
          </Badge>
          {scheduled && (
            <Badge tone="blue" icon={CalendarClock}>
              {linkedCampaign ? linkedCampaign.name : "Agendada"}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[76px_minmax(0,1fr)] gap-1.5">
        <NumberInput
          aria-label="Duração em segundos"
          className="[&_input]:h-8 [&_input]:text-[13px]"
          value={effectiveDuration}
          min={2}
          max={600}
          suffix="s"
          onChange={(v) => v && editItem((it) => (it.durationSec = v))}
        />
        <Select
          aria-label="Transição"
          className="h-8 text-[12.5px]"
          value={item.transition ?? ""}
          onChange={(e) => editItem((it) => (it.transition = (e.target.value || undefined) as Transition | undefined))}
        >
          <option value="">Padrão ({TRANSITION_LABEL[defaultTransition]})</option>
          {TRANSITIONS.map((t) => (
            <option key={t} value={t}>
              {TRANSITION_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex">
          <IconButton
            icon={item.hidden ? EyeOff : Eye}
            label={item.hidden ? "Exibir na TV" : "Ocultar da TV"}
            tone={item.hidden ? "active" : "default"}
            onClick={() => editItem((it) => (it.hidden = !it.hidden))}
          />
          <IconButton icon={Copy} label="Duplicar" onClick={duplicate} />
          <IconButton
            icon={item.kind === "slide" ? CalendarClock : Settings2}
            label={item.kind === "slide" ? "Período e campanha" : "Configurar espaço"}
            onClick={onEdit}
          />
          {slide && (
            <Link
              href={`/admin/pecas/${slide.id}?voltar=${encodeURIComponent(`/admin/programacao?unidade=${draft.units.find((u) => u.id === unitId)?.code}`)}`}
            >
              <IconButton icon={Pencil} label="Abrir para edição" />
            </Link>
          )}
          <IconButton icon={Trash2} label="Remover da programação" tone="danger" onClick={remove} />
        </div>
        <div className="flex">
          <IconButton icon={ArrowLeft} label="Mover para a esquerda" disabled={index === 0} onClick={() => onMove(index, index - 1)} />
          <IconButton
            icon={ArrowRight}
            label="Mover para a direita"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 2)}
          />
        </div>
      </div>
    </div>
  );
});

function ItemSettingsDialog({ item, unitId, onClose }: { item: PlaylistItem | undefined; unitId: string; onClose: () => void }) {
  const { draft, update } = useDraft();
  const editItem = (fn: (it: PlaylistItem) => void) =>
    update((d) => {
      for (const p of d.playlists) {
        const it = p.items.find((x) => x.id === item?.id);
        if (it) fn(it);
      }
    });
  const campaigns = draft.campaigns.filter((c) => c.status !== "archived" && campaignAppliesToUnit(c, unitId));
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.kind === "campaign" ? "Espaço de campanha" : "Período de exibição"}
      footer={
        <Button variant="primary" onClick={onClose}>
          Concluir
        </Button>
      }
    >
      {item?.kind === "slide" && (
        <div className="space-y-5">
          <p className="text-sm text-sand-600">
            {describeSchedule(item.schedule)}. A TV respeita o período automaticamente, sem novo deploy.
          </p>
          <ScheduleFields
            value={item.schedule}
            timezone={draft.settings.timezone}
            onChange={(s) => editItem((it) => it.kind === "slide" && (it.schedule = s))}
          />
          <Field label="Vincular a uma campanha" hint="A peça só aparece enquanto a campanha estiver ativa e no período.">
            <Select
              value={item.campaignId ?? ""}
              onChange={(e) => editItem((it) => it.kind === "slide" && (it.campaignId = e.target.value || undefined))}
            >
              <option value="">Sem vínculo</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {item?.kind === "campaign" && (
        <div className="space-y-5">
          <Field label="Rótulo interno">
            <Input value={item.label} onChange={(e) => editItem((it) => it.kind === "campaign" && (it.label = e.target.value))} />
          </Field>
          <Field label="Campanhas que podem ocupar este espaço" hint="Nenhuma marcada = qualquer campanha ativa desta unidade.">
            <div className="space-y-1.5">
              {campaigns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.campaignIds.includes(c.id)}
                    onChange={(e) =>
                      editItem((it) => {
                        if (it.kind !== "campaign") return;
                        it.campaignIds = e.target.checked ? [...it.campaignIds, c.id] : it.campaignIds.filter((x) => x !== c.id);
                      })
                    }
                  />
                  {c.name}
                </label>
              ))}
              {campaigns.length === 0 && <p className="text-sm text-sand-500">Nenhuma campanha para esta unidade.</p>}
            </div>
          </Field>
          <Field label="Peça substituta" hint="Exibida quando nenhuma campanha estiver ativa.">
            <Select
              value={item.fallbackSlideId ?? ""}
              onChange={(e) => editItem((it) => it.kind === "campaign" && (it.fallbackSlideId = e.target.value || undefined))}
            >
              <option value="">Nenhuma (pular o espaço)</option>
              {draft.slides
                .filter((s) => s.status === "active")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
