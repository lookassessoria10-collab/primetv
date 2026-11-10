"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { ResolvedMedia, TvBrand, TvSettings, TvUnitInfo } from "@/lib/manifest";
import type { Orientation, Theme } from "@/lib/schema";

/** Ambiente compartilhado por todas as peças (TV, prévia e miniaturas). */
export interface SlideEnv {
  orientation: Orientation;
  brand: TvBrand;
  unit: TvUnitInfo | null;
  settings: TvSettings;
  /** false = renderização estática (miniaturas), sem animações. */
  animate: boolean;
  durationSec: number;
  onMediaError?: (mediaId: string) => void;
}

export const SlideEnvContext = createContext<SlideEnv | null>(null);

export function useSlideEnv(): SlideEnv {
  const env = useContext(SlideEnvContext);
  if (!env) throw new Error("SlideEnvContext ausente");
  return env;
}

export const STAGE_SIZE: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

/** Curva de desaceleração suave usada nas revelações. */
export const EASE_OUT_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Texto com ênfase: *palavra* vira itálico dourado; quebras de linha são respeitadas. */
export function Rich({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, pi) =>
            part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <span key={pi} className="pe-em">
                {part.slice(1, -1)}
              </span>
            ) : (
              <span key={pi}>{part}</span>
            ),
          )}
        </span>
      ))}
    </>
  );
}

/** Revelação progressiva de títulos e elementos (transform + opacity). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  x = 0,
  scale = 1,
  duration = 1,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  x?: number;
  scale?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { animate } = useSlideEnv();
  if (!animate) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  const kind =
    scale < 0.88
      ? "pe-rv-zoom-strong"
      : scale < 0.95
        ? "pe-rv-zoom"
        : scale < 1
          ? "pe-rv-zoom-soft"
          : y === 0 && x === 0
            ? "pe-rv-fade"
            : "pe-rv-up";
  return (
    <div className={className} style={{ ...style, animation: `${kind} ${duration}s ${EASE_OUT_CSS} ${0.25 + delay}s both` }}>
      {children}
    </div>
  );
}

/** Tamanho de título conforme o comprimento do texto (legível a alguns metros). */
export function fitSize(text: string, steps: [number, number][], fallback: number): number {
  const len = text.replace(/\*/g, "").length;
  for (const [max, size] of steps) if (len <= max) return size;
  return fallback;
}

export function logoFor(theme: Theme, brand: TvBrand) {
  return theme === "creme" ? brand.logoDark : brand.logoLight;
}

export function symbolFor(theme: Theme, brand: TvBrand) {
  if (theme === "creme") return brand.symbolDark;
  if (theme === "rose") return brand.symbolLight;
  return brand.symbolGold;
}

export function Logo({ theme, width, style }: { theme: Theme; width: number; style?: CSSProperties }) {
  const { brand } = useSlideEnv();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoFor(theme, brand)} alt={brand.name} width={width} style={{ width, height: "auto", display: "block", ...style }} />
  );
}

export function Divider({ theme, width = 760, symbol = 46 }: { theme: Theme; width?: number; symbol?: number }) {
  const { brand } = useSlideEnv();
  const line = (width - symbol - 52) / 2;
  return (
    <div className="pe-divider" style={{ width }}>
      <div className="pe-divider-line" style={{ width: line }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pe-divider-symbol" src={symbolFor(theme, brand)} alt="" width={symbol} height={symbol} />
      <div className="pe-divider-line" style={{ width: line }} />
    </div>
  );
}

export function EyebrowPill({ text, size = 32 }: { text: string; size?: number }) {
  if (!text) return null;
  return (
    <span
      className="pe-eyebrow-pill"
      style={{ fontSize: size, padding: `${size * 0.42}px ${size * 1.3}px ${size * 0.42}px ${size * 1.52}px` }}
    >
      {text}
    </span>
  );
}

export function CtaPill({ text, size = 46 }: { text: string; size?: number }) {
  if (!text) return null;
  return (
    <span className="pe-cta" style={{ fontSize: size, padding: `${size * 0.48}px ${size * 1.25}px` }}>
      {text}
      <span className="pe-cta-arrow">→</span>
    </span>
  );
}

/** Fotografia com enquadramento por ponto focal e zoom fotográfico discreto opcional. */
export function Photo({
  media,
  className,
  style,
  kenBurns = false,
  fit = "cover",
  children,
}: {
  media: ResolvedMedia;
  className?: string;
  style?: CSSProperties;
  kenBurns?: boolean;
  fit?: "cover" | "contain";
  children?: ReactNode;
}) {
  const env = useSlideEnv();
  const objectPosition = `${media.focalX}% ${media.focalY}%`;
  const el =
    media.kind === "video" ? (
      <video
        src={media.url}
        muted
        playsInline
        autoPlay={env.animate}
        loop
        preload="auto"
        style={{ objectFit: fit, objectPosition }}
        onError={() => env.onMediaError?.(media.id)}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt=""
        decoding="async"
        draggable={false}
        style={{ objectFit: fit, objectPosition }}
        onError={() => env.onMediaError?.(media.id)}
      />
    );
  return (
    <div className={`pe-photo ${className || ""}`} style={style}>
      {kenBurns && env.animate ? (
        <div
          className="pe-photo-zoom"
          style={{ transformOrigin: objectPosition, animation: `pe-kenburns ${env.durationSec + 1.5}s linear both` }}
        >
          {el}
        </div>
      ) : (
        el
      )}
      {children}
    </div>
  );
}

const LEAF = "M0,0 C70,-90 70,-230 0,-320 C-70,-230 -70,-90 0,0 Z";

/** Formas orgânicas e florais da identidade (ondas terracota, linhas douradas e pétalas). */
export function Decor({
  theme,
  waves = "bottom",
  leaves = "top-left",
}: {
  theme: Theme;
  waves?: "bottom" | "both" | "none";
  leaves?: "top-left" | "both" | "none";
}) {
  const { orientation } = useSlideEnv();
  const land = orientation === "landscape";
  const W = land ? 1920 : 1080;
  const H = land ? 1080 : 1920;
  const strong = theme === "creme" || theme === "rose";
  const waveOpacity = strong ? 0.95 : 0.55;
  const leafOpacity = strong ? 0.45 : 0.35;
  return (
    <>
      {(leaves === "top-left" || leaves === "both") && <Leaves cx={land ? 120 : 110} cy={land ? 120 : 150} dir={1} opacity={leafOpacity} />}
      {leaves === "both" && <Leaves cx={W - (land ? 140 : 110)} cy={H - (land ? 160 : 260)} dir={-1} opacity={leafOpacity} />}
      <Waves W={W} H={H} waves={waves} opacity={waveOpacity} />
    </>
  );
}

/** Pétalas em linha dourada; giram lentamente via transform de um elemento HTML (composição na GPU). */
function Leaves({ cx, cy, dir, opacity }: { cx: number; cy: number; dir: number; opacity: number }) {
  const { animate, durationSec } = useSlideEnv();
  const size = 700;
  const style: CSSProperties = { left: cx - size / 2, top: cy - size / 2, width: size, height: size };
  const svg = (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden>
      <g fill="none" stroke="var(--pe-gold)" strokeWidth={2.2} opacity={opacity}>
        {[-50, 10, 70, 130].map((r) => (
          <path key={r} d={LEAF} transform={`rotate(${r})`} />
        ))}
      </g>
    </svg>
  );
  if (!animate) {
    return (
      <div className="pe-decor" style={style}>
        {svg}
      </div>
    );
  }
  return (
    <div className="pe-decor" style={{ ...style, animation: `${dir > 0 ? "pe-spin-cw" : "pe-spin-ccw"} ${durationSec + 2}s linear both` }}>
      {svg}
    </div>
  );
}

function Waves({ W, H, waves, opacity }: { W: number; H: number; waves: "bottom" | "both" | "none"; opacity: number }) {
  if (waves === "none") return null;
  const waveOpacity = opacity;
  return (
    <svg className="pe-decor" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ top: 0, left: 0 }} aria-hidden>
      {(waves === "bottom" || waves === "both") && (
        <g transform={`translate(0 ${H - 300}) scale(${W / 1080} 1)`}>
          <path d="M0,120 C230,40 400,210 660,150 C850,105 960,40 1080,70 L1080,300 L0,300 Z" fill="var(--pe-wave)" opacity={waveOpacity} />
          <path
            d="M0,96 C240,20 410,190 670,128 C860,84 970,22 1080,48"
            fill="none"
            stroke="var(--pe-gold)"
            strokeWidth={2.5}
            opacity={0.7}
          />
        </g>
      )}
      {waves === "both" && (
        <g transform={`translate(${W - 520} 0)`}>
          <path d="M80,0 C170,40 230,120 340,150 C420,170 480,210 520,270 L520,0 Z" fill="var(--pe-wave)" opacity={waveOpacity} />
          <path
            d="M40,0 C150,52 220,140 335,172 C420,196 480,240 520,300"
            fill="none"
            stroke="var(--pe-gold)"
            strokeWidth={2.5}
            opacity={0.7}
          />
        </g>
      )}
    </svg>
  );
}

/** Ícone do WhatsApp (desenho próprio simplificado, apenas para a TV). */
export function WhatsappIcon({ size = 64, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path
        d="M32 6C17.6 6 6 17.4 6 31.4c0 4.9 1.4 9.5 4 13.4L6.6 58l13.6-3.5c3.6 2 7.7 3 11.8 3 14.4 0 26-11.4 26-25.4S46.4 6 32 6Z"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M24.2 19.5c-.6-1.3-1.2-1.3-1.8-1.3h-1.5c-.5 0-1.4.2-2.1 1-.7.8-2.8 2.7-2.8 6.5s2.9 7.6 3.3 8.1c.4.5 5.6 8.8 13.8 12 6.8 2.7 8.2 2.1 9.7 2 1.5-.1 4.8-1.9 5.4-3.8.7-1.9.7-3.5.5-3.8-.2-.3-.7-.5-1.5-.9s-4.8-2.3-5.5-2.6c-.7-.3-1.3-.4-1.8.4-.5.8-2.1 2.6-2.5 3.1-.5.5-.9.6-1.7.2-.8-.4-3.4-1.2-6.4-3.9-2.4-2.1-4-4.7-4.4-5.5-.5-.8 0-1.2.4-1.6.4-.4.8-.9 1.2-1.4.4-.5.5-.8.8-1.3.3-.5.1-1-.1-1.4-.2-.4-1.7-4.2-2.5-5.8Z"
        fill={color}
      />
    </svg>
  );
}
