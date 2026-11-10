import { isScheduleActive, localParts } from "./schedule";
import type { SeqEntry, TvCampaign, TvManifest } from "./manifest";
import type { Transition } from "./schema";

/**
 * Monta um ciclo concreto de reprodução a partir do manifesto e do horário atual.
 * O player recalcula o ciclo a cada volta, então campanhas entram e saem da
 * programação automaticamente, sem novo deploy.
 */

export interface CycleEntry {
  /** Chave única da exibição (muda a cada ciclo para animar a troca). */
  key: string;
  slideId: string;
  durationSec: number;
  transition: Transition;
  source: "main" | "campaign" | "fallback";
  campaignId?: string;
  /** Item da programação que originou a exibição. */
  itemKey: string;
}

export interface RotationState {
  /** Créditos do round-robin ponderado por campanha. */
  credit: Record<string, number>;
  /** Próxima peça de cada campanha. */
  cursor: Record<string, number>;
}

export function newRotation(): RotationState {
  return { credit: {}, cursor: {} };
}

export interface CycleOptions {
  /** Peças temporariamente ignoradas (ex.: mídia falhou ao carregar). */
  skip?: (slideId: string) => boolean;
  /** Identificador do ciclo, para gerar chaves únicas. */
  cycleId?: number;
}

export function buildCycle(m: TvManifest, now: Date, rot: RotationState, opts: CycleOptions = {}): CycleEntry[] {
  const parts = localParts(now, m.settings.timezone);
  const skip = opts.skip ?? (() => false);
  const cycleId = opts.cycleId ?? 0;
  const usable = (slideId: string | undefined): slideId is string => !!slideId && !!m.slides[slideId] && !skip(slideId);

  const live = m.campaigns.filter((c) => isScheduleActive(c.schedule, parts));
  const liveIds: Record<string, true> = {};
  for (const c of live) liveIds[c.id] = true;

  const durationOf = (slideId: string, ...overrides: (number | undefined)[]) => {
    for (const o of overrides) if (o && o > 0) return o;
    return m.slides[slideId]?.durationSec || m.settings.defaultDurationSec;
  };
  const transitionOf = (slideId: string, override?: Transition) =>
    override || m.slides[slideId]?.transition || m.settings.defaultTransition;

  const pickCampaign = (allowed: string[]): { campaign: TvCampaign; slideId: string; durationSec?: number } | null => {
    const candidates = live.filter(
      (c) => (allowed.length === 0 || allowed.indexOf(c.id) !== -1) && c.items.some((it) => usable(it.slideId)),
    );
    if (candidates.length === 0) return null;
    // Round-robin ponderado suave: peso define a frequência, prioridade desempata.
    let total = 0;
    let best: TvCampaign | null = null;
    for (const c of candidates) {
      total += c.weight;
      rot.credit[c.id] = (rot.credit[c.id] || 0) + c.weight;
      if (!best || rot.credit[c.id] > rot.credit[best.id] || (rot.credit[c.id] === rot.credit[best.id] && c.priority > best.priority)) {
        best = c;
      }
    }
    if (!best) return null;
    rot.credit[best.id] -= total;
    const items = best.items.filter((it) => usable(it.slideId));
    const idx = (rot.cursor[best.id] || 0) % items.length;
    rot.cursor[best.id] = idx + 1;
    return { campaign: best, slideId: items[idx].slideId, durationSec: items[idx].durationSec };
  };

  const out: CycleEntry[] = [];
  let n = 0;
  const key = (itemKey: string) => `${cycleId}:${n++}:${itemKey}`;

  const run = (seq: SeqEntry[], source: "main" | "fallback") => {
    const hasSlots = seq.some((e) => e.kind === "campaign");
    const every = source === "main" && !hasSlots ? m.unit.autoCampaignEvery : 0;
    let count = 0;
    for (const e of seq) {
      if (e.kind === "slide") {
        if (e.campaignId && !liveIds[e.campaignId]) continue;
        if (!isScheduleActive(e.schedule, parts)) continue;
        if (!usable(e.slideId)) continue;
        out.push({
          key: key(e.key),
          itemKey: e.key,
          slideId: e.slideId,
          durationSec: durationOf(e.slideId, e.durationSec),
          transition: transitionOf(e.slideId, e.transition),
          source,
          campaignId: e.campaignId,
        });
        count++;
        if (every > 0 && live.length > 0 && count % every === 0) {
          const pick = pickCampaign([]);
          if (pick) {
            out.push({
              key: key(`auto-${count}`),
              itemKey: `auto-${count}`,
              slideId: pick.slideId,
              durationSec: durationOf(pick.slideId, pick.durationSec),
              transition: transitionOf(pick.slideId),
              source: "campaign",
              campaignId: pick.campaign.id,
            });
          }
        }
      } else {
        const pick = pickCampaign(e.campaignIds);
        if (pick) {
          out.push({
            key: key(e.key),
            itemKey: e.key,
            slideId: pick.slideId,
            durationSec: durationOf(pick.slideId, e.durationSec, pick.durationSec),
            transition: transitionOf(pick.slideId, e.transition),
            source: "campaign",
            campaignId: pick.campaign.id,
          });
        } else if (usable(e.fallbackSlideId)) {
          out.push({
            key: key(e.key),
            itemKey: e.key,
            slideId: e.fallbackSlideId,
            durationSec: durationOf(e.fallbackSlideId, e.durationSec),
            transition: transitionOf(e.fallbackSlideId, e.transition),
            source,
          });
        }
      }
    }
  };

  run(m.main, "main");
  // Sem nada exibível na programação principal: usa a programação institucional padrão.
  if (out.length === 0) run(m.fallback, "fallback");
  return out;
}

export function cycleDuration(entries: CycleEntry[]): number {
  let total = 0;
  for (const e of entries) total += e.durationSec;
  return total;
}

export function formatDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec < 10 ? "0" : ""}${sec}s`;
}
