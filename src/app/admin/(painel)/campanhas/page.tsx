"use client";

import { Archive, ArrowDown, ArrowUp, CalendarRange, Copy, Megaphone, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { PHASE_TONE } from "@/components/admin/labels";
import { useSlideContext } from "@/components/admin/preview-data";
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
  Segmented,
  Textarea,
  useFeedback,
} from "@/components/admin/ui";
import { slideAvailability, toTvSlide } from "@/lib/manifest";
import {
  CAMPAIGN_PHASE_LABEL,
  campaignAppliesToUnit,
  campaignPhase,
  describeSchedule,
  localParts,
  type CampaignPhase,
} from "@/lib/schedule";
import type { Campaign } from "@/lib/schema";
import { createSlide, newId, SLIDE_TYPE_INFO } from "@/lib/slide-meta";

type Filter = "all" | "live" | "scheduled" | "draft" | "ended" | "archived";

export default function CampanhasPage() {
  const { draft, update } = useDraft();
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const parts = useMemo(() => localParts(new Date(), draft.settings.timezone), [draft.settings.timezone]);

  const rows = draft.campaigns.map((c) => ({ c, phase: campaignPhase(c, parts) }));
  const match = (p: CampaignPhase): boolean => {
    switch (filter) {
      case "all":
        return p !== "archived";
      case "live":
        return p === "live" || p === "waiting";
      case "scheduled":
        return p === "scheduled";
      case "draft":
        return p === "draft" || p === "paused";
      case "ended":
        return p === "ended";
      case "archived":
        return p === "archived";
    }
  };
  const list = rows.filter((r) => match(r.phase));

  const create = () => {
    const now = new Date().toISOString();
    const id = newId("cmp");
    update((d) => {
      d.campaigns.unshift({
        id,
        name: "Nova campanha",
        description: "",
        status: "draft",
        theme: "",
        schedule: {},
        scope: "global",
        unitIds: [],
        items: [],
        priority: 5,
        weight: 1,
        createdAt: now,
        updatedAt: now,
      });
    });
    setEditing(id);
  };

  const patch = (id: string, fn: (c: Campaign) => void) =>
    update((d) => {
      const c = d.campaigns.find((x) => x.id === id);
      if (c) {
        fn(c);
        c.updatedAt = new Date().toISOString();
      }
    });

  const duplicate = (c: Campaign) => {
    const id = newId("cmp");
    const now = new Date().toISOString();
    update((d) => {
      d.campaigns.unshift({ ...structuredClone(c), id, name: `${c.name} (cópia)`, status: "draft", createdAt: now, updatedAt: now });
    });
    toast("Campanha duplicada como rascunho.");
    setEditing(id);
  };

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Programe campanhas com antecedência. No período definido, elas entram automaticamente nos espaços de campanha das TVs — sem novo deploy."
        actions={
          <Button variant="primary" icon={Plus} onClick={create}>
            Nova campanha
          </Button>
        }
      />
      <div className="mb-5">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todas" },
            { value: "live", label: "Ativas agora" },
            { value: "scheduled", label: "Programadas" },
            { value: "draft", label: "Rascunhos e pausadas" },
            { value: "ended", label: "Encerradas" },
            { value: "archived", label: "Arquivadas" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha nesta lista"
          action={
            <Button variant="primary" icon={Plus} onClick={create}>
              Nova campanha
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map(({ c, phase }) => (
            <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-sand-200 bg-white p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-semibold text-sand-900">{c.name}</h3>
                  <Badge tone={PHASE_TONE[phase]}>{CAMPAIGN_PHASE_LABEL[phase]}</Badge>
                  {c.theme && <Badge tone="brand">{c.theme}</Badge>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-sand-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="size-3.5" /> {describeSchedule(c.schedule)}
                  </span>
                  <span>{c.scope === "global" ? "Todas as unidades" : `${c.unitIds.length} unidade(s)`}</span>
                  <span>{c.items.length} peça(s)</span>
                  <span>
                    Prioridade {c.priority} · Peso {c.weight}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                {c.status === "active" ? (
                  <Button size="sm" icon={Pause} onClick={() => patch(c.id, (x) => (x.status = "paused"))}>
                    Pausar
                  </Button>
                ) : c.status !== "archived" ? (
                  <Button size="sm" icon={Play} onClick={() => patch(c.id, (x) => (x.status = "active"))}>
                    Ativar
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => patch(c.id, (x) => (x.status = "draft"))}>
                    Restaurar
                  </Button>
                )}
                <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(c.id)} />
                <IconButton icon={Copy} label="Duplicar" onClick={() => duplicate(c)} />
                {c.status !== "archived" && (
                  <IconButton icon={Archive} label="Arquivar" onClick={() => patch(c.id, (x) => (x.status = "archived"))} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignEditor id={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function CampaignEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { draft, update, mediaById, mediaUrl } = useDraft();
  const { confirm } = useFeedback();
  const router = useRouter();
  const ctx = useSlideContext();
  const [picking, setPicking] = useState(false);
  const c = draft.campaigns.find((x) => x.id === id);
  const parts = localParts(new Date(), draft.settings.timezone);

  const patch = (fn: (c: Campaign) => void) =>
    update((d) => {
      const x = d.campaigns.find((y) => y.id === id);
      if (x) {
        fn(x);
        x.updatedAt = new Date().toISOString();
      }
    });

  const createPromo = () => {
    if (!c) return;
    const slide = createSlide("promo", { name: `${c.name} — peça`, data: { eyebrow: c.name } });
    update((d) => {
      d.slides.unshift(slide);
      d.campaigns.find((x) => x.id === c.id)?.items.push({ slideId: slide.id });
    });
    onClose();
    router.push(`/admin/pecas/${slide.id}?voltar=/admin/campanhas`);
  };

  const remove = async () => {
    if (!c) return;
    const used = draft.playlists.some((p) =>
      p.items.some((i) => (i.kind === "slide" && i.campaignId === c.id) || (i.kind === "campaign" && i.campaignIds.includes(c.id))),
    );
    const ok = await confirm({
      title: "Excluir campanha?",
      danger: true,
      confirmLabel: "Excluir",
      message: used
        ? "Ela está vinculada a itens da programação; os vínculos serão removidos. As peças continuam na biblioteca."
        : "As peças continuam na biblioteca.",
    });
    if (!ok) return;
    update((d) => {
      d.campaigns = d.campaigns.filter((x) => x.id !== c.id);
      for (const p of d.playlists)
        for (const i of p.items) {
          if (i.kind === "slide" && i.campaignId === c.id) delete i.campaignId;
          if (i.kind === "campaign") i.campaignIds = i.campaignIds.filter((x) => x !== c.id);
        }
    });
    onClose();
  };

  const reach = c
    ? draft.units
        .filter((u) => campaignAppliesToUnit(c, u.id))
        .map((u) => {
          const pl = draft.playlists.find((p) => p.id === u.playlistId);
          const slots =
            pl?.items.filter((i) => i.kind === "campaign" && !i.hidden && (i.campaignIds.length === 0 || i.campaignIds.includes(c.id)))
              .length ?? 0;
          return { u, slots };
        })
    : [];

  return (
    <Modal
      open={!!c}
      onClose={onClose}
      side
      title={c?.name || "Campanha"}
      description={c ? `${CAMPAIGN_PHASE_LABEL[campaignPhase(c, parts)]} · ${describeSchedule(c.schedule)}` : ""}
      footer={
        <>
          <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => void remove()}>
            Excluir
          </Button>
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </>
      }
    >
      {c && (
        <div className="space-y-6">
          <div className="grid gap-4">
            <Field label="Nome da campanha">
              <Input value={c.name} maxLength={120} onChange={(e) => patch((x) => (x.name = e.target.value))} />
            </Field>
            <Field label="Descrição interna" hint="Não aparece na TV. Registre a oferta aprovada e as condições.">
              <Textarea rows={3} value={c.description} maxLength={2000} onChange={(e) => patch((x) => (x.description = e.target.value))} />
            </Field>
            <Field label="Identidade / tema" hint="Ex.: Black Friday, Dia das Mães. Usado para organizar.">
              <Input value={c.theme} maxLength={80} onChange={(e) => patch((x) => (x.theme = e.target.value))} />
            </Field>
            <Field label="Status (ativação manual)" hint="Somente campanhas ativas entram na TV, e apenas dentro do período.">
              <Segmented
                value={c.status === "archived" ? "draft" : c.status}
                onChange={(v) => patch((x) => (x.status = v))}
                options={[
                  { value: "draft", label: "Rascunho" },
                  { value: "active", label: "Ativa" },
                  { value: "paused", label: "Pausada" },
                ]}
              />
            </Field>
          </div>

          <Card title="Período" bodyClassName="p-4">
            <ScheduleFields value={c.schedule} timezone={draft.settings.timezone} onChange={(s) => patch((x) => (x.schedule = s))} />
          </Card>

          <Card title="Unidades participantes" bodyClassName="p-4 space-y-3">
            <Segmented
              value={c.scope}
              onChange={(v) => patch((x) => (x.scope = v))}
              options={[
                { value: "global", label: "Todas as unidades" },
                { value: "units", label: "Unidades selecionadas" },
              ]}
            />
            {c.scope === "units" && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {draft.units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.unitIds.includes(u.id)}
                      onChange={(e) =>
                        patch((x) => (x.unitIds = e.target.checked ? [...x.unitIds, u.id] : x.unitIds.filter((y) => y !== u.id)))
                      }
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            )}
            <ul className="space-y-1 text-[12.5px] text-sand-600">
              {reach.map(({ u, slots }) => (
                <li key={u.id}>
                  <strong className="font-medium text-sand-800">{u.name}:</strong>{" "}
                  {slots > 0 ? (
                    `${slots} espaço(s) de campanha na programação.`
                  ) : u.autoCampaignEvery > 0 ? (
                    `inserida automaticamente a cada ${u.autoCampaignEvery} peças.`
                  ) : (
                    <span className="text-amber-700">sem espaço de campanha — não aparecerá.</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Ordem e peso de reprodução" bodyClassName="p-4 grid gap-4 sm:grid-cols-2">
            <Field label="Prioridade (1–10)" hint="Em empate, a de maior prioridade aparece primeiro.">
              <NumberInput value={c.priority} min={1} max={10} onChange={(v) => v && patch((x) => (x.priority = Math.round(v)))} />
            </Field>
            <Field label="Peso (1–10)" hint="Frequência relativa quando várias campanhas estão ativas.">
              <NumberInput value={c.weight} min={1} max={10} onChange={(v) => v && patch((x) => (x.weight = Math.round(v)))} />
            </Field>
          </Card>

          <Card
            title="Peças da campanha"
            description="Alternadas a cada exibição, na ordem abaixo."
            bodyClassName="p-4"
            actions={
              <>
                <Button size="sm" icon={Plus} onClick={() => setPicking(true)}>
                  Adicionar peças
                </Button>
                <Button size="sm" variant="primary" onClick={createPromo}>
                  Criar peça promocional
                </Button>
              </>
            }
          >
            {c.items.length === 0 ? (
              <Notice tone="amber">Adicione ao menos uma peça para a campanha aparecer na TV.</Notice>
            ) : (
              <ul className="space-y-2">
                {c.items.map((it, i) => {
                  const s = draft.slides.find((x) => x.id === it.slideId);
                  const av = s ? slideAvailability(s, mediaById) : { ok: false, reasons: ["peça removida"] };
                  return (
                    <li key={`${it.slideId}-${i}`} className="flex items-center gap-3 rounded-lg border border-sand-200 p-2">
                      <div className="w-12 shrink-0">
                        <SlideThumb slide={s ? toTvSlide(s, mediaById, mediaUrl, true) : null} ctx={ctx} className="rounded" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s?.name ?? "Peça removida"}</p>
                        <p className={cx("text-xs", av.ok ? "text-sand-500" : "text-amber-700")}>
                          {av.ok ? (s ? SLIDE_TYPE_INFO[s.type].label : "") : av.reasons.join("; ")}
                        </p>
                      </div>
                      <NumberInput
                        className="w-20 [&_input]:h-8"
                        value={it.durationSec}
                        min={2}
                        max={600}
                        suffix="s"
                        placeholder={String(s?.durationSec ?? "")}
                        onChange={(v) => patch((x) => (x.items[i].durationSec = v))}
                      />
                      <IconButton
                        icon={ArrowUp}
                        label="Subir"
                        disabled={i === 0}
                        onClick={() => patch((x) => x.items.splice(i - 1, 0, x.items.splice(i, 1)[0]))}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label="Descer"
                        disabled={i === c.items.length - 1}
                        onClick={() => patch((x) => x.items.splice(i + 1, 0, x.items.splice(i, 1)[0]))}
                      />
                      <IconButton icon={Trash2} label="Remover" tone="danger" onClick={() => patch((x) => x.items.splice(i, 1))} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Modal open={picking} onClose={() => setPicking(false)} title="Adicionar peças à campanha" size="xl">
        {picking && c && (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {draft.slides
              .filter((s) => s.status === "active")
              .map((s) => {
                const inCampaign = c.items.some((i) => i.slideId === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={inCampaign}
                    onClick={() => patch((x) => x.items.push({ slideId: s.id }))}
                    className="group text-left disabled:opacity-40"
                  >
                    <SlideThumb
                      slide={toTvSlide(s, mediaById, mediaUrl, true)}
                      ctx={ctx}
                      className="rounded-lg ring-2 ring-transparent group-hover:ring-brand-400"
                    />
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium">{s.name}</p>
                    {inCampaign && <p className="text-[11px] text-emerald-700">Já incluída</p>}
                  </button>
                );
              })}
          </div>
        )}
      </Modal>
    </Modal>
  );
}
