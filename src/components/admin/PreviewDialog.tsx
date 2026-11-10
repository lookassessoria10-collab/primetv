"use client";

import { Clock, Monitor, Pause, Play, RotateCcw, SkipBack, SkipForward, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cycleDuration, formatDuration } from "@/lib/cycle";
import type { TvManifest } from "@/lib/manifest";
import { localParts, zonedStampToDate } from "@/lib/schedule";
import type { Orientation } from "@/lib/schema";
import { api } from "@/lib/client/api";
import { Player, type PlayerController, type PlayerSnapshot } from "@/components/player/Player";
import { useDraft } from "./DraftProvider";
import { useDraftManifest } from "./preview-data";
import { Badge, Button, cx, IconButton, Input, Modal, Segmented, Select } from "./ui";

/**
 * Prévia real da TV: usa o mesmo <Player> e o mesmo cálculo de programação do player público.
 */
export function PreviewDialog({ open, onClose, initialUnitId }: { open: boolean; onClose: () => void; initialUnitId?: string }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pré-visualização da TV"
      description="Mesmo componente e mesmas regras da tela publicada."
      size="full"
    >
      {open && <PreviewBody initialUnitId={initialUnitId} />}
    </Modal>
  );
}

export function PreviewBody({ initialUnitId }: { initialUnitId?: string }) {
  const { draft } = useDraft();
  const [unitId, setUnitId] = useState(initialUnitId ?? draft.units.find((u) => u.active)?.id ?? draft.units[0]?.id);
  const [source, setSource] = useState<"draft" | "published">("draft");
  const [orientation, setOrientation] = useState<Orientation | "unit">("unit");
  const [simulated, setSimulated] = useState("");
  const [simOffset, setSimOffset] = useState<number | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null);
  const [publishedState, setPublished] = useState<{ code: string; data: TvManifest | "missing" } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const controller = useRef<PlayerController | null>(null);

  const unit = draft.units.find((u) => u.id === unitId);
  const draftManifest = useDraftManifest(unit);

  useEffect(() => {
    if (source !== "published" || !unit) return;
    let alive = true;
    api<TvManifest>(`/api/tv/${unit.code}`)
      .then((data) => alive && setPublished({ code: unit.code, data }))
      .catch(() => alive && setPublished({ code: unit.code, data: "missing" }));
    return () => {
      alive = false;
    };
  }, [source, unit]);
  const published = publishedState && publishedState.code === unit?.code ? publishedState.data : null;

  // Congela o manifesto ao iniciar: edições posteriores entram ao reiniciar.
  const manifest = useMemo(() => {
    if (source === "published") return published && published !== "missing" ? published : null;
    return draftManifest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, published, runKey, unitId]);

  const clock = useMemo(() => (simOffset === null ? undefined : () => new Date(Date.now() + simOffset)), [simOffset]);
  const changeSimulated = (value: string) => {
    setSimulated(value);
    // O horário informado é interpretado no fuso da clínica, não no do computador.
    const target = value ? zonedStampToDate(value, draft.settings.timezone)?.getTime() : undefined;
    setSimOffset(target === undefined ? null : target - Date.now());
  };

  const orient: Orientation = orientation === "unit" ? (unit?.orientation ?? "portrait") : orientation;
  const total = snap ? cycleDuration(snap.cycle) : 0;
  const tz = draft.settings.timezone;
  const nowLabel = useNowLabel(clock, tz);
  const restart = useCallback(() => setRunKey((k) => k + 1), []);

  if (!unit) return <p className="text-sm text-sand-500">Cadastre uma unidade para visualizar a programação.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col items-center">
        <div
          className={cx(
            "relative overflow-hidden rounded-xl bg-[#1b0e08] shadow-xl ring-1 ring-black/10",
            orient === "portrait" ? "aspect-[9/16] h-[min(70vh,760px)]" : "aspect-[16/9] w-full max-w-[960px]",
          )}
        >
          {manifest ? (
            <Player
              key={`${unitId}-${source}-${orient}-${runKey}-${simulated}`}
              manifest={manifest}
              mode="preview"
              orientation={orient}
              clock={clock}
              controllerRef={controller}
              onSnapshot={setSnap}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">
              {source === "published" && published === "missing" ? "Esta unidade ainda não existe na versão publicada." : "Carregando…"}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-sand-200">
          <IconButton icon={SkipBack} label="Voltar" onClick={() => controller.current?.prev()} />
          {snap?.paused ? (
            <IconButton icon={Play} label="Reproduzir" onClick={() => controller.current?.play()} />
          ) : (
            <IconButton icon={Pause} label="Pausar" onClick={() => controller.current?.pause()} />
          )}
          <IconButton icon={SkipForward} label="Avançar" onClick={() => controller.current?.next()} />
          <IconButton icon={RotateCcw} label="Reiniciar (aplica edições recentes)" onClick={restart} />
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-3">
          <label className="text-[13px] font-medium text-sand-800">
            Unidade
            <Select className="mt-1.5" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {draft.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code}){u.active ? "" : " — inativa"}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={source}
              onChange={setSource}
              options={[
                { value: "draft", label: "Rascunho" },
                { value: "published", label: "Publicada" },
              ]}
            />
            <Segmented
              size="sm"
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: "unit", label: "Da unidade" },
                { value: "portrait", label: "Vertical", icon: Smartphone },
                { value: "landscape", label: "Horizontal", icon: Monitor },
              ]}
            />
          </div>
          <label className="text-[13px] font-medium text-sand-800">
            Simular data e hora <span className="font-normal text-sand-500">({tz})</span>
            <div className="mt-1.5 flex gap-2">
              <Input type="datetime-local" value={simulated} onChange={(e) => changeSimulated(e.target.value)} />
              {simulated && (
                <Button size="sm" variant="ghost" className="h-10" onClick={() => changeSimulated("")}>
                  Agora
                </Button>
              )}
            </div>
            <span className="mt-1 flex items-center gap-1 text-xs font-normal text-sand-500">
              <Clock className="size-3" /> Horário considerado: {nowLabel}
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-sand-200 bg-sand-50">
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-sand-800">Ciclo atual</p>
            <Badge tone="brand">{snap ? `${snap.cycle.length} telas · ${formatDuration(total)}` : "—"}</Badge>
          </div>
          <ol className="admin-scroll max-h-[46vh] overflow-y-auto p-2 text-[13px]">
            {snap?.contingency && (
              <li className="px-2 py-2 text-amber-700">Nenhuma peça exibível: a TV mostraria a tela de contingência.</li>
            )}
            {snap?.cycle.map((e, i) => {
              const s = manifest?.slides[e.slideId];
              const camp = e.campaignId ? manifest?.campaigns.find((c) => c.id === e.campaignId) : null;
              const active = snap.current?.key === e.key;
              return (
                <li key={e.key} className={cx("flex items-start gap-2 rounded-lg px-2 py-1.5", active && "bg-brand-50 text-brand-800")}>
                  <span className="w-5 shrink-0 text-right text-sand-400 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s?.name ?? e.slideId}</span>
                    {camp && <span className="block truncate text-[11.5px] text-violet-600">Campanha: {camp.name}</span>}
                    {e.source === "fallback" && <span className="block text-[11.5px] text-amber-700">Programação institucional</span>}
                  </span>
                  <span className="shrink-0 text-sand-500 tabular-nums">{e.durationSec}s</span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="text-xs leading-relaxed text-sand-500">
          O ciclo é recalculado a cada volta: campanhas entram e saem conforme o horário, e espaços de campanha alternam entre as peças
          ativas.
        </p>
      </aside>
    </div>
  );
}

function useNowLabel(clock: (() => Date) | undefined, tz: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const p = localParts(clock ? clock() : new Date(), tz);
  const [y, m, d] = p.date.split("-");
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return `${days[p.weekday]}, ${d}/${m}/${y} ${p.time}`;
}
