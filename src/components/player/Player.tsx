"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { buildCycle, newRotation, type CycleEntry, type RotationState } from "@/lib/cycle";
import type { TvManifest, TvSlide } from "@/lib/manifest";
import type { Orientation, Transition } from "@/lib/schema";
import { Contingency } from "@/components/slides/Contingency";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { Stage } from "@/components/slides/Stage";
import { Preloader, type PreloadItem } from "./preloader";

/**
 * Motor de reprodução — o mesmo componente roda na TV e na prévia do painel.
 * - recalcula o ciclo a cada volta (campanhas entram/saem pelo horário);
 * - só exibe uma peça após suas mídias estarem carregadas;
 * - pula peças com falha e as tenta novamente depois;
 * - adota novas versões apenas na troca de peça;
 * - cai na tela de contingência se nada puder ser exibido.
 */

export interface PlayerController {
  play(): void;
  pause(): void;
  next(): void;
  prev(): void;
  restart(): void;
}

export interface PlayerSnapshot {
  index: number;
  cycle: CycleEntry[];
  current: CycleEntry | null;
  paused: boolean;
  contingency: boolean;
  version: string | null;
  startedAt: number;
}

export interface PlayerProps {
  manifest: TvManifest | null;
  mode: "tv" | "preview";
  orientation?: Orientation;
  clock?: () => Date;
  initialPaused?: boolean;
  controllerRef?: Ref<PlayerController | null>;
  onSnapshot?: (s: PlayerSnapshot) => void;
  /** Chamado a cada troca de peça. Retornar true interrompe o avanço (ex.: recarregamento da TV). */
  onBoundary?: () => boolean | void;
  onAdopt?: (m: TvManifest) => void;
  contingencyNote?: string;
}

interface Shown {
  entry: CycleEntry;
  slide: TvSlide;
  manifest: TvManifest;
  z: number;
}

const RETRY_CONTINGENCY_MS = 30_000;
const SKIP_CYCLES = 2;

function slideItems(slide: TvSlide): PreloadItem[] {
  return Object.values(slide.media).map((m) => ({ url: m.url, kind: m.kind }));
}

function brandItems(m: TvManifest): PreloadItem[] {
  return [m.brand.logoLight, m.brand.logoDark, m.brand.symbolGold, m.brand.symbolLight, m.brand.symbolDark].map((url) => ({
    url,
    kind: "image" as const,
  }));
}

interface Tx {
  t: Transition;
  ms: number;
}

interface Layer extends Shown {
  phase: "in" | "out";
  tx: Tx;
}

const CSS_EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const CSS_EASE_IO = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Transições em CSS (keyframes em slides.css): a peça nova entra por cima e a anterior
 * permanece até ser coberta. Usam apenas opacity, transform e clip-path.
 */
function layerAnimation(phase: Layer["phase"], { t, ms }: Tx): string {
  const d = ms / 1000;
  if (phase === "in") {
    switch (t) {
      case "fade":
        return `pe-op-in ${d / 2}s ease ${d / 2}s both`;
      case "zoom":
        return `pe-zoom-in ${d * 1.15}s ${CSS_EASE_OUT} 0s both`;
      case "rise":
        return `pe-rise-in ${d}s ${CSS_EASE_OUT} 0s both`;
      case "mask":
        return `pe-mask-in ${d * 1.3}s ${CSS_EASE_IO} 0s both`;
      default:
        return `pe-op-in ${d}s ${CSS_EASE_IO} 0s both`;
    }
  }
  if (t === "fade") return `pe-op-out ${d / 2}s ease 0s both`;
  return `pe-op-out 0.25s linear ${exitHold({ t, ms }) / 1000}s both`;
}

/** Tempo em que a peça anterior continua visível enquanto a nova entra. */
function exitHold({ t, ms }: Tx): number {
  if (t === "fade") return 0;
  return t === "mask" ? ms * 1.3 : t === "zoom" ? ms * 1.1 : ms;
}

export function Player({
  manifest,
  mode,
  orientation,
  clock,
  initialPaused = false,
  controllerRef,
  onSnapshot,
  onBoundary,
  onAdopt,
  contingencyNote,
}: PlayerProps) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const layerCleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contingency, setContingency] = useState(false);
  const [loading, setLoading] = useState(true);

  const preloader = useRef(new Preloader());
  const active = useRef<TvManifest | null>(null);
  const pending = useRef<TvManifest | null>(null);
  const cycle = useRef<CycleEntry[]>([]);
  const nextCycle = useRef<CycleEntry[] | null>(null);
  const index = useRef(-1);
  const cycleId = useRef(0);
  const rotation = useRef<RotationState>(newRotation());
  const failures = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);
  const zCounter = useRef(1);
  const paused = useRef(initialPaused);
  const remainingMs = useRef<number | null>(null);
  const timerStartedAt = useRef(0);
  const timerDuration = useRef(0);
  const lastShownAt = useRef(0);
  const halted = useRef(false);
  const startedAt = useRef(0);
  const currentEntry = useRef<CycleEntry | null>(null);
  const contingencyRef = useRef(false);
  const running = useRef(false);

  const now = useCallback(() => (clock ? clock() : new Date()), [clock]);

  const snapshot = useCallback(() => {
    onSnapshot?.({
      index: index.current,
      cycle: cycle.current,
      current: currentEntry.current,
      paused: paused.current,
      contingency: contingencyRef.current,
      version: active.current?.version ?? null,
      startedAt: startedAt.current,
    });
  }, [onSnapshot]);

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const build = useCallback(
    (id: number) => {
      const m = active.current;
      if (!m) return [];
      return buildCycle(m, now(), rotation.current, {
        cycleId: id,
        skip: (slideId) => (failures.current.get(slideId) ?? -1) >= id,
      });
    },
    [now],
  );

  // Funções mutuamente dependentes ficam em refs para evitar closures desatualizadas.
  const advanceRef = useRef<() => void>(() => {});
  const showRef = useRef<(i: number) => void>(() => {});

  const schedule = (ms: number) => {
    clearTimers();
    timerStartedAt.current = Date.now();
    timerDuration.current = ms;
    if (paused.current) {
      remainingMs.current = ms;
      return;
    }
    remainingMs.current = null;
    timer.current = setTimeout(() => advanceRef.current(), ms);
  };

  const enterContingency = () => {
    clearTimers();
    contingencyRef.current = true;
    setContingency(true);
    setLoading(false);
    currentEntry.current = null;
    setShown(null);
    setLayers([]);
    snapshot();
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(
      () => {
        failures.current.clear();
        cycleId.current += 1;
        cycle.current = build(cycleId.current);
        nextCycle.current = null;
        showRef.current(0);
      },
      mode === "tv" ? RETRY_CONTINGENCY_MS : 4000,
    );
  };

  const markFailure = (slideId: string) => {
    failures.current.set(slideId, cycleId.current + SKIP_CYCLES);
  };

  /** Coloca a nova peça por cima; a anterior sai após a transição e é removida do DOM. */
  const present = (next: Shown) => {
    const tx: Tx = { t: next.entry.transition, ms: next.manifest.settings.transitionMs };
    setShown(next);
    setLayers((prev) => {
      const current = prev.filter((l) => l.phase === "in" && l.entry.key !== next.entry.key).slice(-1);
      return [...current.map((l) => ({ ...l, phase: "out" as const, tx })), { ...next, phase: "in" as const, tx }];
    });
    if (layerCleanup.current) clearTimeout(layerCleanup.current);
    layerCleanup.current = setTimeout(
      () => setLayers((prev) => prev.filter((l) => l.phase === "in")),
      exitHold(tx) + (tx.t === "fade" ? tx.ms / 2 : 250) + 300,
    );
  };

  // As funções do motor são atualizadas após cada renderização (antes dos efeitos que as usam).
  useLayoutEffect(() => {
    showRef.current = (start: number) => {
      const my = ++token.current;
      const run = async () => {
        let i = start;
        const limit = Math.max(cycle.current.length, 1) * 2;
        for (let attempt = 0; attempt < limit; attempt++) {
          const m = active.current;
          if (!m) return;
          if (cycle.current.length === 0) break;
          if (i >= cycle.current.length) {
            cycleId.current += 1;
            cycle.current = nextCycle.current ?? build(cycleId.current);
            nextCycle.current = null;
            i = 0;
            if (cycle.current.length === 0) break;
          }
          const entry = cycle.current[i];
          const slide = m.slides[entry.slideId];
          if (!slide) {
            i++;
            continue;
          }
          const ok = await preloader.current.ensure(slideItems(slide), mode === "tv" ? 15_000 : 20_000);
          if (my !== token.current) return;
          if (!ok) {
            markFailure(entry.slideId);
            i++;
            continue;
          }
          index.current = i;
          currentEntry.current = entry;
          lastShownAt.current = Date.now();
          contingencyRef.current = false;
          setContingency(false);
          setLoading(false);
          present({ entry, slide, manifest: m, z: ++zCounter.current });
          schedule(entry.durationSec * 1000);
          snapshot();

          // Pré-carrega as próximas peças; no fim do ciclo, já calcula o próximo.
          const upcoming: CycleEntry[] = [];
          for (let k = i + 1; k < cycle.current.length && upcoming.length < 2; k++) upcoming.push(cycle.current[k]);
          if (upcoming.length < 2) {
            if (!nextCycle.current) nextCycle.current = build(cycleId.current + 1);
            for (const e of nextCycle.current) {
              if (upcoming.length >= 2) break;
              upcoming.push(e);
            }
          }
          for (const e of upcoming) {
            const s = m.slides[e.slideId];
            if (s) void preloader.current.ensure(slideItems(s));
          }
          return;
        }
        if (my === token.current) enterContingency();
      };
      void run();
    };

    advanceRef.current = () => {
      clearTimers();
      if (halted.current) return;
      if (onBoundary?.() === true) {
        halted.current = true;
        return;
      }
      // Nova versão: adotada somente aqui, entre uma peça e outra.
      if (pending.current) {
        active.current = pending.current;
        pending.current = null;
        cycleId.current += 1;
        cycle.current = build(cycleId.current);
        nextCycle.current = null;
        onAdopt?.(active.current);
        showRef.current(0);
        return;
      }
      showRef.current(index.current + 1);
    };
  });

  const restart = useCallback(() => {
    clearTimers();
    if (retryTimer.current) clearTimeout(retryTimer.current);
    halted.current = false;
    if (pending.current) {
      active.current = pending.current;
      pending.current = null;
    }
    rotation.current = newRotation();
    failures.current.clear();
    cycleId.current += 1;
    cycle.current = build(cycleId.current);
    nextCycle.current = null;
    index.current = -1;
    startedAt.current = Date.now();
    showRef.current(0);
  }, [build]);

  // Recebe o manifesto (inicial ou atualizado).
  useEffect(() => {
    if (!manifest) {
      if (!active.current) {
        setLoading(false);
        contingencyRef.current = true;
        setContingency(true);
      }
      return;
    }
    if (!running.current) {
      running.current = true;
      active.current = manifest;
      pending.current = null;
      void preloader.current.ensure(brandItems(manifest));
      restart();
      return;
    }
    if (manifest !== active.current) {
      pending.current = manifest;
      // Em contingência não há troca a aguardar: adota imediatamente.
      if (contingencyRef.current) restart();
    }
  }, [manifest, restart]);

  // Limpeza geral (também cobre a montagem dupla do modo de desenvolvimento).
  useEffect(
    () => () => {
      running.current = false;
      token.current++;
      clearTimers();
      if (layerCleanup.current) clearTimeout(layerCleanup.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // Vigia: se nada avançou muito além do previsto, força a troca.
  useEffect(() => {
    if (mode !== "tv") return;
    const id = setInterval(() => {
      if (paused.current || halted.current || contingencyRef.current) return;
      const expected = (currentEntry.current?.durationSec ?? 10) * 1000 + 45_000;
      if (Date.now() - lastShownAt.current > expected) {
        token.current++;
        advanceRef.current();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [mode]);

  useImperativeHandle(
    controllerRef,
    (): PlayerController => ({
      play() {
        if (!paused.current) return;
        paused.current = false;
        const ms = remainingMs.current ?? 0;
        remainingMs.current = null;
        if (currentEntry.current) {
          timerStartedAt.current = Date.now();
          timerDuration.current = ms;
          timer.current = setTimeout(() => advanceRef.current(), Math.max(ms, 300));
        }
        snapshot();
      },
      pause() {
        if (paused.current) return;
        paused.current = true;
        if (timer.current) {
          clearTimers();
          remainingMs.current = Math.max(0, timerDuration.current - (Date.now() - timerStartedAt.current));
        }
        snapshot();
      },
      next() {
        token.current++;
        advanceRef.current();
      },
      prev() {
        token.current++;
        clearTimers();
        showRef.current(Math.max(0, index.current - 1));
      },
      restart() {
        token.current++;
        restart();
      },
    }),
    [restart, snapshot],
  );

  const handleMediaError = useCallback((slideId: string) => {
    if (currentEntry.current?.slideId !== slideId) return;
    markFailure(slideId);
    token.current++;
    advanceRef.current();
  }, []);

  const m = shown?.manifest ?? manifest;
  const orient: Orientation = orientation ?? m?.unit.orientation ?? "portrait";

  return (
    <Stage
      orientation={orient}
      rotation={mode === "tv" ? (m?.unit.rotation ?? 0) : 0}
      overscanPercent={mode === "tv" ? (m?.unit.overscanPercent ?? 0) : 0}
    >
      {(contingency || (loading && !shown)) && (
        <div className="pe-layer" style={{ zIndex: 0 }}>
          <Contingency
            orientation={orient}
            brand={m?.brand}
            title={m?.settings.fallback.title}
            message={m?.settings.fallback.message}
            imageUrl={m?.settings.fallback.imageUrl}
            note={contingency ? contingencyNote : undefined}
          />
        </div>
      )}
      {!contingency &&
        layers.map((layer) => (
          <div key={layer.entry.key} className="pe-layer" style={{ zIndex: layer.z, animation: layerAnimation(layer.phase, layer.tx) }}>
            <SlideRenderer
              slide={layer.slide}
              env={{
                orientation: orient,
                brand: layer.manifest.brand,
                unit: layer.manifest.unit,
                settings: layer.manifest.settings,
                animate: true,
                durationSec: layer.entry.durationSec,
                onMediaError: () => handleMediaError(layer.slide.id),
              }}
              onRenderError={() => handleMediaError(layer.slide.id)}
            />
          </div>
        ))}
    </Stage>
  );
}
