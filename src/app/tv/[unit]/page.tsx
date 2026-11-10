import type { Metadata, Viewport } from "next";
import { TvClient } from "@/components/player/TvClient";
import "@/components/slides/slides.css";

export const metadata: Metadata = {
  title: "Prime TV",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1b0e08",
};

/** Player público de uma unidade: /tv/[codigo]. Não exige login. */
export default async function TvPage({ params, searchParams }: PageProps<"/tv/[unit]">) {
  const { unit } = await params;
  const query = await searchParams;
  return <TvClient unitCode={decodeURIComponent(unit).toLowerCase()} debug={query.debug === "1"} />;
}
