"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { TvSlide } from "@/lib/manifest";
import { SlideEnvContext, type SlideEnv } from "./parts";
import { SlideBody } from "./templates";
import "./slides.css";

class SlideErrorBoundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[prime-tv] falha ao desenhar peça:", error.message, info.componentStack?.slice(0, 200));
    this.props.onError?.();
  }
  render() {
    if (this.state.failed)
      return (
        <div className="pe-slide pe-theme-chocolate">
          <div className="pe-bg" />
        </div>
      );
    return this.props.children;
  }
}

/** Renderiza uma peça. É o MESMO componente na TV, na prévia do painel e nas miniaturas. */
export function SlideRenderer({ slide, env, onRenderError }: { slide: TvSlide; env: SlideEnv; onRenderError?: () => void }) {
  return (
    <SlideEnvContext.Provider value={env}>
      <SlideErrorBoundary onError={onRenderError}>
        <SlideBody slide={slide} />
      </SlideErrorBoundary>
    </SlideEnvContext.Provider>
  );
}
