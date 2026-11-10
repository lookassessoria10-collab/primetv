"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Orientation } from "@/lib/schema";
import { STAGE_SIZE } from "./parts";
import "./slides.css";

/**
 * Palco de desenho fixo (1080×1920 ou 1920×1080) escalado para caber no espaço disponível,
 * sem distorção. Suporta rotação para TVs instaladas em pé que não giram a imagem.
 */
export function Stage({
  orientation,
  rotation = 0,
  overscanPercent = 0,
  children,
  className,
}: {
  orientation: Orientation;
  rotation?: 0 | 90 | 180 | 270;
  overscanPercent?: number;
  children: ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((prev) =>
        prev && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height },
      );
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { w, h } = STAGE_SIZE[orientation];
  const rotated = rotation === 90 || rotation === 270;
  let transform = "translate(-50%, -50%)";
  if (box) {
    const availW = rotated ? box.h : box.w;
    const availH = rotated ? box.w : box.h;
    const s = Math.min(availW / w, availH / h) * (1 - Math.min(Math.max(overscanPercent, 0), 8) / 100);
    transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${s})`;
  }

  return (
    <div ref={outer} className={`pe-stage-outer ${className || ""}`}>
      <div className="pe-stage" style={{ width: w, height: h, transform, visibility: box ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
  );
}
