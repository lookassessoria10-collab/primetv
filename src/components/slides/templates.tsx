"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { formatPhone, whatsappLink, type ResolvedMedia, type TvSlide } from "@/lib/manifest";
import type { SlideData, Theme } from "@/lib/schema";
import {
  CtaPill,
  Decor,
  EASE_OUT_CSS,
  Divider,
  EyebrowPill,
  fitSize,
  Logo,
  Photo,
  Reveal,
  Rich,
  STAGE_SIZE,
  symbolFor,
  useSlideEnv,
  WhatsappIcon,
} from "./parts";
import { QrCode } from "./QrCode";

const themeClass = (t: Theme) => `pe-slide pe-theme-${t}`;

function Frame({ media, label, style, delay = 0 }: { media?: ResolvedMedia; label?: string; style?: CSSProperties; delay?: number }) {
  return (
    <Reveal delay={delay} y={34} className="pe-frame" style={style}>
      {media ? <Photo media={media} /> : <div className="pe-photo" />}
      {label ? <span className="pe-label">{label}</span> : null}
    </Reveal>
  );
}

function Placeholder({ theme, text }: { theme: Theme; text: string }) {
  return (
    <div className={themeClass(theme)}>
      <div className="pe-bg" />
      <div className="pe-col pe-center" style={{ top: 0, bottom: 0, left: 80, right: 80, justifyContent: "center" }}>
        <div className="pe-body" style={{ fontSize: 56 }}>
          {text}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO A — Arte pronta                                                 */
/* ------------------------------------------------------------------ */
export function ArtSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"art">;
  const media = d.mediaId ? slide.media[d.mediaId] : undefined;
  if (!media) return <Placeholder theme="terracota" text="Selecione a arte desta peça." />;

  const land = env.orientation === "landscape";
  const { w: W, h: H } = STAGE_SIZE[env.orientation];
  const disclaimer = d.showDisclaimer ? env.settings.resultsDisclaimer : "";
  const strip = disclaimer && !land ? 96 : 0;
  const availH = H - strip;
  // A arte nunca é esticada nem cortada: sempre "contain".
  const scale = Math.min(W / media.width, availH / media.height);
  const aw = Math.round(media.width * scale);
  const ah = Math.round(media.height * scale);
  const left = Math.round((W - aw) / 2);
  const top = Math.round((availH - ah) / 2);
  const side = left; // espaço lateral livre (TV horizontal)
  const motionAllowed = d.kenBurns && !media.hasText;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt=""
      decoding="async"
      draggable={false}
      style={{ width: "100%", height: "100%", display: "block" }}
      onError={() => env.onMediaError?.(media.id)}
    />
  );

  return (
    <div className={themeClass("terracota")}>
      {d.background === "blur" ? (
        <div className="pe-art-blur" style={{ backgroundImage: `url("${media.url}")` }} />
      ) : (
        <>
          <div className="pe-bg" style={land ? undefined : { background: "linear-gradient(180deg, #a85a38 0%, #6e2f1b 100%)" }} />
          {land && <Decor theme="chocolate" waves="none" leaves="both" />}
        </>
      )}
      {env.animate ? (
        <div
          className="pe-art-img"
          style={{
            left,
            top,
            width: aw,
            height: ah,
            boxShadow: side > 40 || strip ? "0 30px 80px rgba(0,0,0,.35)" : undefined,
            animation: motionAllowed
              ? `pe-op-in 1s ease both, pe-kenburns-soft ${env.durationSec + 1}s linear both`
              : `pe-art-in 1.2s ${EASE_OUT_CSS} both`,
          }}
        >
          {img}
        </div>
      ) : (
        <div className="pe-art-img" style={{ left, top, width: aw, height: ah }}>
          {img}
        </div>
      )}
      {land && side > 260 && d.background !== "blur" && (
        <>
          <div className="pe-col" style={{ top: 0, bottom: 0, left: 0, width: side, justifyContent: "center" }}>
            <Reveal delay={0.4}>
              <Logo theme="chocolate" width={Math.min(side - 120, 440)} />
            </Reveal>
          </div>
          <div
            className="pe-col pe-center"
            style={{ top: 0, bottom: 0, right: 0, width: side, justifyContent: "center", padding: "0 70px" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={symbolFor("chocolate", env.brand)} alt="" width={90} height={90} style={{ opacity: 0.9 }} />
            {disclaimer && (
              <div className="pe-disclaimer" style={{ fontSize: 28, marginTop: 30, color: "rgba(255,247,239,.8)" }}>
                {disclaimer}
              </div>
            )}
          </div>
        </>
      )}
      {strip > 0 && (
        <div className="pe-strip" style={{ height: strip }}>
          <span className="pe-disclaimer" style={{ fontSize: 28, color: "rgba(255,245,236,.88)" }}>
            {disclaimer}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO B — Antes e depois                                              */
/* ------------------------------------------------------------------ */
export function BeforeAfterSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"beforeAfter">;
  if (d.source === "composed") {
    const artSlide: TvSlide = {
      ...slide,
      type: "art",
      data: { mediaId: d.composedMediaId, background: "brand", kenBurns: false, showDisclaimer: d.showDisclaimer },
    };
    return <ArtSlide slide={artSlide} />;
  }
  const theme = d.theme;
  const before = d.beforeMediaId ? slide.media[d.beforeMediaId] : undefined;
  const after = d.afterMediaId ? slide.media[d.afterMediaId] : undefined;
  const land = env.orientation === "landscape";
  const disclaimer = d.showDisclaimer ? d.disclaimer || env.settings.resultsDisclaimer : "";
  const titleSize = land
    ? fitSize(
        d.title,
        [
          [24, 96],
          [40, 80],
        ],
        66,
      )
    : fitSize(
        d.title,
        [
          [16, 116],
          [24, 100],
          [40, 86],
        ],
        74,
      );
  const sideBySide = land || d.layout === "sideBySide";

  const head = (
    <>
      <Reveal>
        <EyebrowPill text={d.eyebrow} size={land ? 28 : 32} />
      </Reveal>
      <Reveal delay={0.1} className="pe-display pe-center" style={{ fontSize: titleSize, marginTop: land ? 22 : 34 }}>
        <Rich text={d.title} />
      </Reveal>
      <Reveal delay={0.2} style={{ marginTop: land ? 22 : 34 }}>
        <Divider theme={theme} width={land ? 640 : 760} />
      </Reveal>
    </>
  );

  return (
    <div className={themeClass(theme)}>
      <div className="pe-bg" />
      <Decor theme={theme} waves="both" leaves="top-left" />
      <div
        className="pe-col"
        style={land ? { top: 60, bottom: 150, left: 120, right: 120 } : { top: 110, bottom: 280, left: 90, right: 90 }}
      >
        {head}
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            width: "100%",
            marginTop: land ? 40 : 52,
            display: "flex",
            flexDirection: sideBySide ? "row" : "column",
            justifyContent: "center",
            alignItems: "stretch",
          }}
        >
          <Frame
            media={before}
            label={d.beforeLabel}
            delay={0.35}
            style={sideBySide ? { flex: "1 1 0", marginRight: 22, maxWidth: land ? 760 : undefined } : { flex: "1 1 0", marginBottom: 58 }}
          />
          <Frame
            media={after}
            label={d.afterLabel}
            delay={0.85}
            style={sideBySide ? { flex: "1 1 0", marginLeft: 22, maxWidth: land ? 760 : undefined } : { flex: "1 1 0" }}
          />
        </div>
        {disclaimer && (
          <Reveal delay={1.1} className="pe-disclaimer pe-center" style={{ fontSize: land ? 24 : 28, marginTop: 52 }}>
            {disclaimer}
          </Reveal>
        )}
      </div>
      <div className="pe-col" style={{ left: 0, right: 0, bottom: land ? 44 : 64 }}>
        <Reveal delay={1.2}>
          <Logo theme={theme === "creme" ? "creme" : "chocolate"} width={land ? 330 : 380} />
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO C — Campanha promocional                                        */
/* ------------------------------------------------------------------ */
function OfferCard({ d, width, compact }: { d: SlideData<"promo">; width: number; compact?: boolean }) {
  const { animate } = useSlideEnv();
  const chars = (d.highlight + d.highlightSuffix).length + 1;
  const numberSize = Math.min(compact ? 200 : 230, Math.floor((width - 120) / (chars * 0.7)));
  if (!d.highlight && !d.highlightDetail) return null;
  return (
    <div className="pe-offer" style={{ width, padding: compact ? "40px 54px 46px" : "48px 60px 54px" }}>
      {animate && <div className="pe-offer-shine" style={{ animation: "pe-shine 6s ease-in-out 1.4s infinite both" }} />}
      {d.highlightPrefix && (
        <div className="pe-caps" style={{ fontSize: compact ? 36 : 42, color: "#fff4ea", letterSpacing: "0.14em" }}>
          {d.highlightPrefix}
        </div>
      )}
      <Reveal delay={0.55} scale={0.92} y={0} className="pe-offer-number" style={{ fontSize: numberSize, marginTop: 6 }}>
        <span className="pe-gold-text">{d.highlight}</span>
        {d.highlightSuffix && <span className="pe-white-text"> {d.highlightSuffix}</span>}
      </Reveal>
      {d.highlightDetail && (
        <>
          <div className="pe-offer-line" style={{ margin: compact ? "22px 0 22px" : "28px 0 26px" }} />
          <div className="pe-caps pe-center" style={{ fontSize: compact ? 32 : 38, color: "#fff4ea", letterSpacing: "0.12em" }}>
            {d.highlightDetail}
          </div>
        </>
      )}
    </div>
  );
}

function PromoEyebrow({ text, size }: { text: string; size: number }) {
  if (!text) return null;
  return (
    <div className="pe-center">
      <div className="pe-eyebrow-text" style={{ fontSize: size, lineHeight: 1.1 }}>
        {text}
      </div>
      <div style={{ width: 260, height: 2, margin: `${size * 0.35}px auto 0`, background: "var(--pe-line)" }} />
    </div>
  );
}

export function PromoSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"promo">;
  const theme = d.theme;
  const photo = d.mediaId ? slide.media[d.mediaId] : undefined;
  const land = env.orientation === "landscape";
  const headSize = land
    ? fitSize(
        d.headline,
        [
          [30, 92],
          [60, 78],
        ],
        66,
      )
    : fitSize(
        d.headline,
        [
          [24, 104],
          [48, 92],
          [80, 80],
        ],
        70,
      );

  const background = photo ? (
    <>
      <Photo media={photo} className="pe-fill" kenBurns />
      <div className="pe-photo-overlay" />
    </>
  ) : (
    <>
      <div className="pe-bg" />
      <Decor theme={theme} waves="none" leaves="both" />
    </>
  );

  if (land) {
    return (
      <div className={themeClass(theme)}>
        {background}
        <div className="pe-col" style={{ top: 0, bottom: 0, left: 130, width: 860, justifyContent: "center", alignItems: "flex-start" }}>
          <Reveal>
            <Logo theme={theme === "creme" ? "creme" : "chocolate"} width={380} />
          </Reveal>
          <Reveal delay={0.1} style={{ marginTop: 50 }}>
            <div className="pe-eyebrow-text" style={{ fontSize: 56 }}>
              {d.eyebrow}
            </div>
          </Reveal>
          <Reveal delay={0.2} className="pe-display" style={{ fontSize: headSize, marginTop: 26 }}>
            <Rich text={d.headline} />
          </Reveal>
          {d.text && (
            <Reveal delay={0.3} className="pe-body" style={{ fontSize: 46, marginTop: 26 }}>
              <Rich text={d.text} />
            </Reveal>
          )}
          <Reveal delay={0.9} style={{ marginTop: 50 }}>
            <CtaPill text={d.cta} size={40} />
          </Reveal>
          {d.footnote && (
            <Reveal delay={1} className="pe-disclaimer" style={{ fontSize: 24, marginTop: 28 }}>
              {d.footnote}
            </Reveal>
          )}
        </div>
        <div className="pe-col" style={{ top: 0, bottom: 0, right: 120, width: 760, justifyContent: "center" }}>
          <Reveal delay={0.45} scale={0.96}>
            <OfferCard d={d} width={760} compact />
          </Reveal>
        </div>
      </div>
    );
  }

  return (
    <div className={themeClass(theme)}>
      {background}
      <div className="pe-col pe-center" style={{ top: 120, bottom: 110, left: 80, right: 80, justifyContent: "center" }}>
        <Reveal>
          <Logo theme={theme === "creme" ? "creme" : "chocolate"} width={440} />
        </Reveal>
        <Reveal delay={0.12} style={{ marginTop: 64 }}>
          <PromoEyebrow text={d.eyebrow} size={68} />
        </Reveal>
        {d.headline && (
          <Reveal delay={0.25} className="pe-display pe-center" style={{ fontSize: headSize, marginTop: 50 }}>
            <Rich text={d.headline} />
          </Reveal>
        )}
        <Reveal delay={0.45} scale={0.96} style={{ marginTop: 70 }}>
          <OfferCard d={d} width={920} />
        </Reveal>
        {d.text && (
          <Reveal delay={0.7} className="pe-body pe-center" style={{ fontSize: 52, marginTop: 46 }}>
            <Rich text={d.text} />
          </Reveal>
        )}
        <Reveal delay={0.9} style={{ marginTop: 64 }}>
          <CtaPill text={d.cta} size={48} />
        </Reveal>
        {d.footnote && (
          <Reveal delay={1} className="pe-disclaimer pe-center" style={{ fontSize: 30, marginTop: 36 }}>
            {d.footnote}
          </Reveal>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO D — Destaque de procedimento                                    */
/* ------------------------------------------------------------------ */
export function ProcedureSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"procedure">;
  const theme = d.theme;
  const photo = d.mediaId ? slide.media[d.mediaId] : undefined;
  const land = env.orientation === "landscape";
  const logoTheme: Theme = theme === "creme" ? "creme" : "chocolate";

  if (land) {
    return (
      <div className={themeClass(theme)}>
        <div className="pe-bg" />
        <Decor theme={theme} waves="bottom" leaves="none" />
        {photo && (
          <Reveal delay={0.1} scale={0.97} y={0} style={{ position: "absolute", left: 150, top: 110, width: 700, height: 860 }}>
            <div className="pe-arch-outline" />
            <Photo media={photo} className="pe-arch" style={{ width: "100%", height: "100%" }} kenBurns />
          </Reveal>
        )}
        <div
          className="pe-col pe-center"
          style={{ top: 0, bottom: 120, left: photo ? 940 : 200, right: photo ? 120 : 200, justifyContent: "center" }}
        >
          <Reveal>
            <EyebrowPill text={d.eyebrow} size={28} />
          </Reveal>
          <Reveal
            delay={0.15}
            className="pe-display pe-center"
            style={{
              fontSize: fitSize(
                d.title,
                [
                  [18, 104],
                  [30, 88],
                ],
                72,
              ),
              marginTop: 30,
            }}
          >
            <Rich text={d.title} />
          </Reveal>
          <Reveal delay={0.25} style={{ marginTop: 30 }}>
            <Divider theme={theme} width={560} />
          </Reveal>
          {d.text && (
            <Reveal delay={0.4} className="pe-body pe-center" style={{ fontSize: 50, marginTop: 34 }}>
              <Rich text={d.text} />
            </Reveal>
          )}
          <Reveal delay={0.7} style={{ marginTop: 44 }}>
            <CtaPill text={d.cta} size={40} />
          </Reveal>
        </div>
        <div className="pe-col" style={{ right: photo ? 120 : 0, left: photo ? 940 : 0, bottom: 40 }}>
          <Logo theme={logoTheme} width={320} />
        </div>
      </div>
    );
  }

  return (
    <div className={themeClass(theme)}>
      <div className="pe-bg" />
      <Decor theme={theme} waves="both" leaves="top-left" />
      <div
        className="pe-col pe-center"
        style={{ top: 130, bottom: 300, left: 90, right: 90, justifyContent: photo ? "flex-start" : "center" }}
      >
        <Reveal>
          <EyebrowPill text={d.eyebrow} size={32} />
        </Reveal>
        <Reveal
          delay={0.12}
          className="pe-display pe-center"
          style={{
            fontSize: photo
              ? fitSize(
                  d.title,
                  [
                    [18, 112],
                    [26, 96],
                    [40, 82],
                  ],
                  70,
                )
              : fitSize(
                  d.title,
                  [
                    [18, 132],
                    [30, 112],
                  ],
                  92,
                ),
            marginTop: 34,
          }}
        >
          <Rich text={d.title} />
        </Reveal>
        <Reveal delay={0.22} style={{ marginTop: 34 }}>
          <Divider theme={theme} />
        </Reveal>
        {photo && (
          <Reveal delay={0.3} scale={0.97} y={0} style={{ flex: "1 1 0", minHeight: 0, width: 780, marginTop: 66, position: "relative" }}>
            <div className="pe-arch-outline" />
            <Photo media={photo} className="pe-arch" style={{ width: "100%", height: "100%" }} kenBurns />
          </Reveal>
        )}
        {d.text && (
          <Reveal
            delay={0.55}
            className="pe-body pe-center"
            style={{ fontSize: photo ? 54 : 64, marginTop: photo ? 60 : 50, maxWidth: 880 }}
          >
            <Rich text={d.text} />
          </Reveal>
        )}
        {d.cta && (
          <Reveal delay={0.8} style={{ marginTop: photo ? 44 : 70 }}>
            <CtaPill text={d.cta} size={44} />
          </Reveal>
        )}
      </div>
      <div className="pe-col" style={{ left: 0, right: 0, bottom: 64 }}>
        <Reveal delay={1}>
          <Logo theme={logoTheme} width={380} />
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO E — Institucional (abertura, mensagem, encerramento)            */
/* ------------------------------------------------------------------ */
export function InstitutionalSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"institutional">;
  const theme = d.theme;
  const land = env.orientation === "landscape";
  const photo = d.mediaId ? slide.media[d.mediaId] : undefined;
  const logoTheme: Theme = theme === "creme" ? "creme" : "chocolate";

  if (d.variant === "opening") {
    return (
      <div className={themeClass(theme)}>
        <div className="pe-bg" />
        {photo && (
          <>
            <Photo media={photo} className="pe-fill" kenBurns />
            <div className="pe-photo-overlay" />
          </>
        )}
        <Decor theme={theme} waves="none" leaves="both" />
        <div className="pe-col pe-center" style={{ top: 0, bottom: 0, left: 80, right: 80, justifyContent: "center" }}>
          <Reveal scale={0.82} y={0} duration={1.4}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={symbolFor(theme === "creme" ? "creme" : "chocolate", env.brand)}
              alt=""
              width={land ? 200 : 260}
              height={land ? 200 : 260}
            />
          </Reveal>
          {d.showLogo && (
            <Reveal delay={0.5} y={30} duration={1.3} style={{ marginTop: land ? 50 : 70 }}>
              <Logo theme={logoTheme} width={land ? 760 : 860} />
            </Reveal>
          )}
          {(d.title || d.text) && (
            <Reveal delay={0.9} style={{ marginTop: 70 }}>
              <Divider theme={theme} width={land ? 620 : 700} />
            </Reveal>
          )}
          {d.title && (
            <Reveal
              delay={1}
              className="pe-display pe-center"
              style={{
                fontSize: fitSize(
                  d.title,
                  [
                    [30, 92],
                    [60, 80],
                  ],
                  68,
                ),
                marginTop: 50,
              }}
            >
              <Rich text={d.title} />
            </Reveal>
          )}
          {d.text && (
            <Reveal delay={1.15} className="pe-body pe-center" style={{ fontSize: 54, marginTop: 30 }}>
              <Rich text={d.text} />
            </Reveal>
          )}
        </div>
      </div>
    );
  }

  const closing = d.variant === "closing";
  const titleSize = land
    ? fitSize(
        d.title,
        [
          [30, 104],
          [60, 88],
          [90, 76],
        ],
        66,
      )
    : fitSize(
        d.title,
        [
          [24, 124],
          [45, 108],
          [70, 96],
          [110, 84],
        ],
        74,
      );

  const textBlock = (
    <>
      {!photo && (
        <Reveal y={0} scale={0.85}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={symbolFor(theme, env.brand)} alt="" width={84} height={84} />
        </Reveal>
      )}
      {d.eyebrow && (
        <Reveal
          delay={0.08}
          className="pe-caps pe-center"
          style={{ fontSize: land ? 28 : 32, letterSpacing: "0.26em", color: "var(--pe-gold)", marginTop: photo ? 0 : 44 }}
        >
          {d.eyebrow}
        </Reveal>
      )}
      <Reveal delay={0.18} className="pe-display pe-center" style={{ fontSize: titleSize, marginTop: 40 }}>
        <Rich text={d.title} />
      </Reveal>
      {d.text && (
        <>
          <Reveal delay={0.32} style={{ marginTop: 50 }}>
            <Divider theme={theme} width={land ? 560 : 640} />
          </Reveal>
          <Reveal delay={0.45} className="pe-body pe-center" style={{ fontSize: land ? 52 : 62, marginTop: 44 }}>
            <Rich text={d.text} />
          </Reveal>
        </>
      )}
      {d.cta && (
        <Reveal delay={0.7} style={{ marginTop: closing ? 76 : 56 }}>
          <CtaPill text={d.cta} size={land ? 42 : 48} />
        </Reveal>
      )}
    </>
  );

  if (photo) {
    return (
      <div className={themeClass(theme)}>
        <div className="pe-bg" />
        <Reveal
          y={0}
          duration={1.4}
          style={
            land
              ? { position: "absolute", left: 0, top: 0, bottom: 0, width: 900 }
              : { position: "absolute", left: 0, right: 0, top: 0, height: 1020 }
          }
        >
          <Photo media={photo} className="pe-fill" kenBurns />
          <div
            className="pe-fill"
            style={{
              background: land
                ? "linear-gradient(90deg, rgba(0,0,0,0) 55%, var(--pe-bg2) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0) 55%, var(--pe-bg2) 100%)",
            }}
          />
        </Reveal>
        <div
          className="pe-col pe-center"
          style={
            land
              ? { top: 0, bottom: 120, left: 960, right: 110, justifyContent: "center" }
              : { top: 980, bottom: 190, left: 90, right: 90, justifyContent: "center" }
          }
        >
          {textBlock}
        </div>
        {d.showLogo && (
          <div className="pe-col" style={land ? { left: 960, right: 110, bottom: 50 } : { left: 0, right: 0, bottom: 64 }}>
            <Logo theme={logoTheme} width={360} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={themeClass(theme)}>
      <div className="pe-bg" />
      <Decor theme={theme} waves={closing ? "both" : "bottom"} leaves="both" />
      <div
        className="pe-col pe-center"
        style={{ top: 0, bottom: land ? 150 : 260, left: land ? 220 : 100, right: land ? 220 : 100, justifyContent: "center" }}
      >
        {textBlock}
      </div>
      {d.showLogo && (
        <div className="pe-col" style={{ left: 0, right: 0, bottom: land ? 50 : 80 }}>
          <Reveal delay={0.9}>
            <Logo theme={logoTheme} width={closing ? (land ? 420 : 520) : land ? 340 : 400} />
          </Reveal>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO F — Chamada para ação                                           */
/* ------------------------------------------------------------------ */
export function CtaSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"cta">;
  const theme = d.theme;
  const land = env.orientation === "landscape";
  const unit = env.unit;
  const whatsapp = unit?.whatsapp || env.settings.contact.whatsapp;
  const waMessage = unit?.whatsappMessage || env.settings.contact.whatsappMessage;
  const qrValue = d.qrTarget === "url" ? (d.url && /^https?:\/\//.test(d.url) ? d.url : null) : whatsappLink(whatsapp, waMessage);
  const showQr = d.showQr && !!qrValue;
  const showPhone = d.showWhatsapp && !!whatsapp;
  const message = unit?.ctaMessage || d.text;
  const photo = d.mediaId ? slide.media[d.mediaId] : undefined;
  const logoTheme: Theme = theme === "creme" ? "creme" : "chocolate";
  const titleSize = land
    ? fitSize(
        d.title,
        [
          [30, 96],
          [60, 82],
        ],
        70,
      )
    : fitSize(
        d.title,
        [
          [24, 118],
          [48, 104],
          [80, 90],
        ],
        78,
      );

  const contact = (showQr || showPhone) && (
    <Reveal delay={0.55} scale={0.95} style={{ marginTop: land ? 0 : 76 }} className="pe-center">
      {showQr && qrValue && (
        <div className="pe-qr-card" style={{ padding: land ? 32 : 38, display: "inline-block" }}>
          <QrCode value={qrValue} size={land ? 330 : 380} />
        </div>
      )}
      {showQr && d.qrLabel && (
        <div className="pe-caps" style={{ fontSize: land ? 24 : 28, marginTop: 26, color: "var(--pe-ink-soft)" }}>
          {d.qrLabel}
        </div>
      )}
      {showPhone && (
        <div style={{ marginTop: showQr ? 44 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WhatsappIcon size={land ? 60 : 72} color="var(--pe-gold)" />
          <span className="pe-phone" style={{ fontSize: land ? 66 : 78, marginLeft: 22 }}>
            {formatPhone(whatsapp)}
          </span>
        </div>
      )}
    </Reveal>
  );

  const text = (
    <>
      {d.eyebrow && (
        <Reveal>
          <div className="pe-eyebrow-text" style={{ fontSize: land ? 52 : 62 }}>
            {d.eyebrow}
          </div>
        </Reveal>
      )}
      <Reveal delay={0.15} className={`pe-display ${land ? "" : "pe-center"}`} style={{ fontSize: titleSize, marginTop: 36 }}>
        <Rich text={d.title} />
      </Reveal>
      {message && (
        <Reveal delay={0.3} className={`pe-body ${land ? "" : "pe-center"}`} style={{ fontSize: land ? 50 : 58, marginTop: 40 }}>
          <Rich text={message} />
        </Reveal>
      )}
    </>
  );

  const unitLine = unit && (
    <div className="pe-caps" style={{ fontSize: land ? 22 : 26, color: "var(--pe-ink-soft)", marginBottom: 22, letterSpacing: "0.22em" }}>
      {unit.name}
    </div>
  );

  return (
    <div className={themeClass(theme)}>
      <div className="pe-bg" />
      {photo && (
        <>
          <Photo media={photo} className="pe-fill" kenBurns />
          <div className="pe-photo-overlay" />
        </>
      )}
      <Decor theme={theme} waves="bottom" leaves="both" />
      {land ? (
        <>
          <div
            className="pe-col"
            style={{
              top: 0,
              bottom: 140,
              left: 140,
              width: showQr || showPhone ? 960 : 1640,
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            {text}
          </div>
          {(showQr || showPhone) && (
            <div className="pe-col" style={{ top: 0, bottom: 140, right: 140, width: 620, justifyContent: "center" }}>
              {contact}
            </div>
          )}
          <div className="pe-col" style={{ left: 0, right: 0, bottom: 40 }}>
            {unitLine}
            <Logo theme={logoTheme} width={330} />
          </div>
        </>
      ) : (
        <>
          <div className="pe-col pe-center" style={{ top: 140, bottom: 290, left: 90, right: 90, justifyContent: "center" }}>
            {text}
            {contact}
          </div>
          <div className="pe-col" style={{ left: 0, right: 0, bottom: 70 }}>
            {unitLine}
            <Logo theme={logoTheme} width={400} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIPO G — Vídeo                                                       */
/* ------------------------------------------------------------------ */
export function VideoSlide({ slide }: { slide: TvSlide }) {
  const env = useSlideEnv();
  const d = slide.data as SlideData<"video">;
  const video = d.mediaId ? slide.media[d.mediaId] : undefined;
  const poster = d.posterMediaId ? slide.media[d.posterMediaId] : undefined;
  const [failed, setFailed] = useState(false);
  if (!video) return <Placeholder theme="chocolate" text="Selecione o vídeo desta peça." />;

  const { w: W, h: H } = STAGE_SIZE[env.orientation];
  const sameShape = Math.abs(video.width / video.height - W / H) < 0.08;
  const fit = sameShape ? "cover" : "contain";

  if (failed || !env.animate) {
    if (poster) {
      return (
        <div className={themeClass("chocolate")}>
          <div className="pe-bg" />
          <Photo media={poster} className="pe-fill" fit={sameShape ? "cover" : "contain"} />
        </div>
      );
    }
    if (failed) return <Placeholder theme="chocolate" text="" />;
  }

  return (
    <div className={themeClass("chocolate")}>
      {fit === "contain" && (
        <div className="pe-art-blur" style={poster ? { backgroundImage: `url("${poster.url}")` } : { background: "#24110a" }} />
      )}
      <video
        className="pe-fill"
        src={video.url}
        poster={poster?.url}
        muted
        playsInline
        autoPlay={env.animate}
        loop
        preload="auto"
        style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: `${video.focalX}% ${video.focalY}%` }}
        onError={() => {
          if (poster) setFailed(true);
          else env.onMediaError?.(video.id);
        }}
      />
    </div>
  );
}

export function SlideBody({ slide }: { slide: TvSlide }): ReactNode {
  switch (slide.type) {
    case "art":
      return <ArtSlide slide={slide} />;
    case "beforeAfter":
      return <BeforeAfterSlide slide={slide} />;
    case "promo":
      return <PromoSlide slide={slide} />;
    case "procedure":
      return <ProcedureSlide slide={slide} />;
    case "institutional":
      return <InstitutionalSlide slide={slide} />;
    case "cta":
      return <CtaSlide slide={slide} />;
    case "video":
      return <VideoSlide slide={slide} />;
    default:
      return null;
  }
}
