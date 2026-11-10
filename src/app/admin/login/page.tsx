import type { Metadata } from "next";
import { missingAuthConfig } from "@/lib/server/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") ? sp.next : "/admin";
  const missing = missingAuthConfig();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_20%_10%,#5a2c19_0%,#1f0e07_70%)] p-4">
      <div className="pointer-events-none absolute -right-40 -bottom-40 size-[520px] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.png" alt="Prime Esthetics" className="h-auto w-64" />
          <p className="mt-3 text-[11px] font-medium tracking-[0.28em] text-[#e9c37d] uppercase">Prime TV · Painel</p>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl shadow-black/30">
          <LoginForm next={next} expired={sp.expirada === "1"} missing={missing} />
        </div>
        <p className="mt-6 text-center text-xs text-white/50">Acesso restrito à administração da Prime Esthetics.</p>
      </div>
    </div>
  );
}
