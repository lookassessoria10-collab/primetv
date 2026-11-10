"use client";

import { memo } from "react";
import type { TvSlide } from "@/lib/manifest";
import type { Orientation } from "@/lib/schema";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { Stage } from "@/components/slides/Stage";
import type { SlideContext } from "./preview-data";
import { cx } from "./ui";

/** Miniatura estática de uma peça, desenhada pelo mesmo componente da TV. */
export const SlideThumb = memo(function SlideThumb({
  slide,
  ctx,
  orientation = "portrait",
  className,
  animate = false,
  replayKey,
}: {
  slide: TvSlide | null;
  ctx: SlideContext;
  orientation?: Orientation;
  className?: string;
  animate?: boolean;
  replayKey?: number;
}) {
  return (
    <div
      className={cx(
        "thumb-stage relative overflow-hidden bg-[#1b0e08]",
        orientation === "portrait" ? "aspect-[9/16]" : "aspect-[16/9]",
        className,
      )}
    >
      {slide ? (
        <Stage orientation={orientation}>
          <SlideRenderer
            key={replayKey}
            slide={slide}
            env={{ orientation, brand: ctx.brand, unit: ctx.unit, settings: ctx.settings, animate, durationSec: slide.durationSec }}
          />
        </Stage>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] text-white/60">Peça indisponível</div>
      )}
    </div>
  );
});
