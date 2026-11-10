"use client";

import dynamic from "next/dynamic";

/** O player roda somente no navegador (lê o cache local e não precisa de renderização no servidor). */
const TvApp = dynamic(() => import("./TvApp").then((m) => m.TvApp), {
  ssr: false,
  loading: () => <div className="tv-root" />,
});

export function TvClient(props: { unitCode: string; debug: boolean }) {
  return <TvApp {...props} />;
}
