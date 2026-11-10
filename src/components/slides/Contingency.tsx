"use client";

import { useState } from "react";
import { DEFAULT_BRAND_FILES, type TvBrand } from "@/lib/manifest";
import type { Orientation } from "@/lib/schema";
import "./slides.css";

/**
 * Tela de contingência com a identidade Prime Esthetics.
 * Não depende de dados do servidor: funciona mesmo sem programação ou conexão.
 */
export function Contingency({
  orientation = "portrait",
  brand,
  title,
  message,
  imageUrl,
  note,
}: {
  orientation?: Orientation;
  brand?: TvBrand;
  title?: string;
  message?: string;
  imageUrl?: string;
  /** Texto técnico discreto (ex.: "unidade não encontrada"). */
  note?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const land = orientation === "landscape";
  const logo = brand?.logoLight || DEFAULT_BRAND_FILES.logoLight;
  const symbol = brand?.symbolGold || DEFAULT_BRAND_FILES.symbolGold;
  const name = brand?.name || "Prime Esthetics";

  return (
    <div className="pe-slide pe-theme-chocolate">
      <div className="pe-bg" />
      {imageUrl && !imageFailed && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="pe-fill"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImageFailed(true)}
          />
          <div className="pe-photo-overlay" />
        </>
      )}
      <div className="pe-col pe-center" style={{ top: 0, bottom: 0, left: 80, right: 80, justifyContent: "center" }}>
        <div style={{ animation: "pe-pulse 3.2s ease-in-out infinite alternate both" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={symbol} alt="" width={land ? 170 : 220} height={land ? 170 : 220} />
        </div>
        {logoFailed ? (
          <div className="pe-display" style={{ fontSize: land ? 110 : 120, marginTop: 50 }}>
            {name}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={name}
            style={{ width: land ? 760 : 860, height: "auto", marginTop: 60 }}
            onError={() => setLogoFailed(true)}
          />
        )}
        {title && title !== name && (
          <div className="pe-display pe-center" style={{ fontSize: land ? 72 : 82, marginTop: 70 }}>
            {title}
          </div>
        )}
        {message && (
          <div className="pe-body pe-center" style={{ fontSize: land ? 46 : 54, marginTop: 34 }}>
            {message}
          </div>
        )}
      </div>
      {note && (
        <div className="pe-col" style={{ left: 0, right: 0, bottom: 36 }}>
          <span className="pe-disclaimer" style={{ fontSize: 20, opacity: 0.45 }}>
            {note}
          </span>
        </div>
      )}
    </div>
  );
}
