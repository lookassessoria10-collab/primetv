import type { Metadata } from "next";
import { Bodoni_Moda, Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

// Fontes auto-hospedadas no build (funcionam offline na TV).
const display = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--nf-display",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--nf-serif",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--nf-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Prime TV", template: "%s · Prime TV" },
  description: "Comunicação digital das unidades Prime Esthetics.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
