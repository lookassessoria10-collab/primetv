"use client";

import { useMemo } from "react";
import { buildBrand, buildUnitManifest, toTvSlide, type TvManifest, type TvSettings, type TvSlide, type TvUnitInfo } from "@/lib/manifest";
import type { Slide, Store, Unit } from "@/lib/schema";
import { useDraft } from "./DraftProvider";

/** Manifesto de uma unidade a partir do rascunho, com as MESMAS regras do servidor. */
export function useDraftManifest(unit: Unit | undefined, store?: Store): TvManifest | null {
  const { draft, mediaUrl } = useDraft();
  const source = store ?? draft;
  return useMemo(() => (unit ? buildUnitManifest(source, unit, { resolveUrl: mediaUrl }) : null), [source, unit, mediaUrl]);
}

export interface SlideContext {
  brand: TvManifest["brand"];
  settings: TvSettings;
  unit: TvUnitInfo | null;
}

/** Contexto visual (marca, configurações, unidade de exemplo) para miniaturas e editor. */
export function useSlideContext(unit?: Unit): SlideContext {
  const { draft, mediaUrl, mediaById } = useDraft();
  return useMemo(() => {
    const u = unit ?? draft.units.find((x) => x.active) ?? draft.units[0];
    const m = u ? buildUnitManifest({ ...draft, slides: [], campaigns: [], playlists: [] }, u, { resolveUrl: mediaUrl }) : null;
    return {
      brand: buildBrand(draft.settings, mediaById, mediaUrl),
      settings: m?.settings ?? {
        timezone: draft.settings.timezone,
        defaultDurationSec: draft.settings.defaultDurationSec,
        defaultTransition: draft.settings.defaultTransition,
        transitionMs: draft.settings.transitionMs,
        resultsDisclaimer: draft.settings.resultsDisclaimer,
        contact: draft.settings.contact,
        fallback: { title: draft.settings.fallback.title, message: draft.settings.fallback.message },
        player: draft.settings.player,
      },
      unit: m?.unit ?? null,
    };
  }, [draft, unit, mediaUrl, mediaById]);
}

/** Peça do rascunho pronta para desenhar (inclui mídias pendentes, para conferência). */
export function useTvSlide(slide: Slide | undefined): TvSlide | null {
  const { mediaUrl, mediaById } = useDraft();
  return useMemo(() => (slide ? toTvSlide(slide, mediaById, mediaUrl, true) : null), [slide, mediaById, mediaUrl]);
}
