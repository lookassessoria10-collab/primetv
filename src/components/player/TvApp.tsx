"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MANIFEST_VERSION, manifestMediaUrls, type TvManifest } from "@/lib/manifest";
import { Contingency } from "@/components/slides/Contingency";
import { Stage } from "@/components/slides/Stage";
import { Player, type PlayerSnapshot } from "./Player";
import { Preloader } from "./preloader";

/**
 * Aplicação da TV: busca a programação publicada, guarda a última versão válida,
 * aquece o cache antes de adotar atualizações e se recupera sozinha de falhas.
 */

type Status = "loading" | "ok" | "offline" | "not-found";

const DEFAULT_POLL_S = 60;
const ERROR_WINDOW_MS = 10 * 60 * 1000;
const ERROR_LIMIT = 25;
const MIN_RELOAD_GAP_MS = 10 * 60 * 1000;

function cacheKey(unit: string) {
  return `primetv:manifest:${unit}`;
}

function readCached(unit: string): TvManifest | null {
  try {
    const raw = localStorage.getItem(cacheKey(unit));
    if (!raw) return null;
    const m = JSON.parse(raw) as TvManifest;
    return m && m.unit && m.slides ? m : null;
  } catch {
    return null;
  }
}

function writeCached(unit: string, m: TvManifest) {
  try {
    localStorage.setItem(cacheKey(unit), JSON.stringify(m));
  } catch {
    /* armazenamento indisponível: segue apenas em memória */
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: ctrl?.signal });
  } finally {
    clearTimeout(t);
  }
}

export function TvApp({ unitCode, debug }: { unitCode: string; debug: boolean }) {
  // Renderizado apenas no navegador (ver TvClient): pode ler a última programação válida já na primeira renderização.
  const [manifest, setManifest] = useState<TvManifest | null>(() => readCached(unitCode));
  const [status, setStatus] = useState<Status>(() => (readCached(unitCode) ? "ok" : "loading"));
  const [uptimeMin, setUptimeMin] = useState(0);
  const [snap, setSnap] = useState<PlayerSnapshot | null>(null);
  const [online, setOnline] = useState(true);

  const preloader = useRef(new Preloader());
  const version = useRef<string | null>(null);
  const reloadWanted = useRef(false);
  const reloadReady = useRef(false);
  const bootAt = useRef(0);
  const errors = useRef<number[]>([]);
  const pollSeconds = useRef(DEFAULT_POLL_S);
  const reloadHours = useRef(6);
  const adopting = useRef(false);

  const adopt = useCallback(
    (m: TvManifest) => {
      version.current = m.version;
      pollSeconds.current = m.settings.player.pollSeconds || DEFAULT_POLL_S;
      reloadHours.current = m.settings.player.reloadHours ?? 6;
      writeCached(unitCode, m);
      setManifest(m);
      try {
        navigator.serviceWorker?.controller?.postMessage({ type: "keep-media", urls: manifestMediaUrls(m) });
      } catch {
        /* sem service worker */
      }
    },
    [unitCode],
  );

  // Carga inicial e verificação periódica de novas versões.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    bootAt.current = Date.now();

    const cached = readCached(unitCode);
    if (cached) {
      version.current = cached.version;
      pollSeconds.current = cached.settings.player.pollSeconds || DEFAULT_POLL_S;
      reloadHours.current = cached.settings.player.reloadHours ?? 6;
    }

    const poll = async () => {
      try {
        const res = await fetchWithTimeout(`/api/tv/${encodeURIComponent(unitCode)}`, 20_000);
        if (res.status === 404) {
          setStatus("not-found");
          setOnline(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const m = (await res.json()) as TvManifest;
        setOnline(true);
        if (m.manifestVersion > MANIFEST_VERSION) {
          // Programação exige um player mais novo: recarrega no próximo intervalo.
          reloadWanted.current = true;
          return;
        }
        if (m.version === version.current) {
          setStatus("ok");
          return;
        }
        if (adopting.current) return;
        adopting.current = true;
        try {
          // Só adota a nova versão quando todos os arquivos estiverem disponíveis.
          const ready = version.current === null ? true : await preloader.current.warm(manifestMediaUrls(m));
          if (ready && !stopped) {
            adopt(m);
            setStatus("ok");
          }
        } finally {
          adopting.current = false;
        }
      } catch {
        setOnline(false);
        setStatus((s) => (s === "loading" ? (version.current ? "ok" : "offline") : s === "ok" ? "ok" : "offline"));
      } finally {
        if (!stopped) timer = setTimeout(poll, pollSeconds.current * 1000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [unitCode, adopt]);

  // Service worker: cache de páginas, scripts e mídias para funcionar sem internet.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/tv/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Na primeira visita o service worker ainda não interceptou a página e os scripts:
        // pede que ele os guarde agora, para a TV abrir mesmo sem internet após reiniciar.
        timer = setTimeout(() => {
          const urls = new Set<string>([location.pathname, `/api/tv/${encodeURIComponent(unitCode)}`]);
          for (const entry of performance.getEntriesByType("resource")) {
            try {
              const u = new URL(entry.name);
              if (u.origin === location.origin && (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/brand/"))) {
                urls.add(u.pathname + u.search);
              }
            } catch {
              /* ignora */
            }
          }
          reg.active?.postMessage({ type: "precache", urls: Array.from(urls) });
        }, 8000);
      })
      .catch(() => undefined);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [unitCode]);

  // Recarregamento preventivo (memória) e recuperação de erros recorrentes.
  useEffect(() => {
    const onError = () => {
      const now = Date.now();
      errors.current = errors.current.filter((t) => now - t < ERROR_WINDOW_MS);
      errors.current.push(now);
      if (errors.current.length >= ERROR_LIMIT) reloadWanted.current = true;
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    const check = setInterval(async () => {
      setUptimeMin(Math.round((Date.now() - bootAt.current) / 60000));
      const hours = reloadHours.current;
      if (hours > 0 && Date.now() - bootAt.current > hours * 3600_000) reloadWanted.current = true;
      if (!reloadWanted.current || reloadReady.current) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem("primetv:last-reload") || 0);
      } catch {
        /* ignore */
      }
      if (Date.now() - last < MIN_RELOAD_GAP_MS) return;
      try {
        const res = await fetchWithTimeout("/api/health", 8000);
        // Só recarrega se o servidor responder, para não trocar uma tela funcionando por um erro.
        if (res.ok) reloadReady.current = true;
      } catch {
        /* sem conexão: continua exibindo */
      }
    }, 60_000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(check);
    };
  }, []);

  // Mantém a tela ligada quando o navegador permite.
  useEffect(() => {
    type WakeLockSentinel = { release(): Promise<void> };
    let sentinel: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinel> } };
    const request = () => {
      if (document.visibilityState !== "visible" || !nav.wakeLock) return;
      nav.wakeLock.request("screen").then(
        (s) => (sentinel = s),
        () => undefined,
      );
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      sentinel?.release().catch(() => undefined);
    };
  }, []);

  const onBoundary = useCallback(() => {
    if (reloadReady.current) {
      try {
        sessionStorage.setItem("primetv:last-reload", String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
      return true;
    }
    return false;
  }, []);

  const toggleFullscreen = () => {
    const d = document as Document & { webkitFullscreenElement?: Element };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (!document.fullscreenElement && !d.webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => undefined);
      else el.webkitRequestFullscreen?.();
    }
  };

  let body;
  if (status === "not-found") {
    body = (
      <Stage orientation="portrait">
        <Contingency note={`Unidade "${unitCode}" não encontrada na programação publicada.`} />
      </Stage>
    );
  } else if (!manifest) {
    body = (
      <Stage orientation="portrait">
        <Contingency note={status === "offline" ? "Aguardando conexão…" : undefined} />
      </Stage>
    );
  } else {
    body = (
      <Player
        manifest={manifest}
        mode="tv"
        onBoundary={onBoundary}
        onSnapshot={debug ? setSnap : undefined}
        contingencyNote={manifest.unit.active ? undefined : "Unidade desativada no painel."}
      />
    );
  }

  return (
    <div className="tv-root" onClick={toggleFullscreen} onContextMenu={(e) => e.preventDefault()}>
      {body}
      {debug && (
        <div className="tv-debug">
          {[
            `Prime TV · ${unitCode}`,
            `Versão: ${manifest?.version ?? "—"} · Status: ${status} · ${online ? "online" : "offline"}`,
            snap?.current
              ? `Peça ${snap.index + 1}/${snap.cycle.length}: ${manifest?.slides[snap.current.slideId]?.name ?? snap.current.slideId} (${snap.current.durationSec}s)`
              : snap?.contingency
                ? "Contingência"
                : "Carregando…",
            `Em execução há ${uptimeMin} min`,
          ].join("\n")}
        </div>
      )}
    </div>
  );
}
