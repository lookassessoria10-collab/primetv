"use client";

import {
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clapperboard,
  Cloud,
  Images,
  LayoutDashboard,
  ListVideo,
  Loader2,
  LogOut,
  Megaphone,
  MonitorPlay,
  Settings,
  Store as StoreIcon,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import { useDraft } from "./DraftProvider";
import { PreviewDialog } from "./PreviewDialog";
import { Button, cx } from "./ui";

const NAV = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/admin/programacao", label: "Programação", icon: ListVideo },
  { href: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/admin/pecas", label: "Peças", icon: Clapperboard },
  { href: "/admin/midias", label: "Mídias", icon: Images },
  { href: "/admin/unidades", label: "Unidades", icon: StoreIcon },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function StatusPill() {
  const { status, statusLabel, publishState } = useDraft();
  const tone = {
    loading: "bg-sand-100 text-sand-600",
    dirty: "bg-amber-50 text-amber-800 ring-amber-200",
    saving: "bg-sky-50 text-sky-700 ring-sky-200",
    saved: "bg-sky-50 text-sky-800 ring-sky-200",
    publishing: "bg-violet-50 text-violet-700 ring-violet-200",
    deploying: "bg-violet-50 text-violet-700 ring-violet-200",
    published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    error: "bg-red-50 text-red-700 ring-red-200",
  }[status];
  const Icon =
    status === "published"
      ? CheckCircle2
      : status === "error"
        ? CircleAlert
        : status === "saving" || status === "publishing" || status === "deploying"
          ? Loader2
          : status === "saved"
            ? Cloud
            : CircleDot;
  const spin = status === "saving" || status === "publishing" || status === "deploying";
  return (
    <span
      title={publishState?.message || statusLabel}
      className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 ring-inset", tone)}
    >
      <Icon className={cx("size-3.5", spin && "animate-spin")} aria-hidden />
      <span className="max-w-[260px] truncate">{statusLabel}</span>
    </span>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, storage, dirty, busy, save, publish, unpublished } = useDraft();
  const [previewOpen, setPreviewOpen] = useState(false);

  const logout = async () => {
    if (dirty && !window.confirm("Há alterações não salvas. Sair mesmo assim?")) return;
    await api("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sand-200 bg-white lg:flex">
        <div className="px-5 pt-6 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-brown.png" alt="Prime Esthetics" className="h-auto w-[168px]" />
          <p className="mt-2 text-[11px] font-medium tracking-[0.2em] text-sand-500 uppercase">Prime TV · Painel</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Seções do painel">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition",
                  active ? "bg-brand-50 text-brand-700" : "text-sand-600 hover:bg-sand-100 hover:text-sand-900",
                )}
              >
                <item.icon className={cx("size-4", active ? "text-brand-500" : "text-sand-400")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sand-200 p-4 text-[12px] text-sand-500">
          <p className="truncate">
            <span className="font-medium text-sand-700">{user}</span>
          </p>
          <p className="mt-0.5 truncate" title={storage.repo}>
            {storage.kind === "github" ? `GitHub · ${storage.repo}@${storage.branch}` : "Modo local (desenvolvimento)"}
          </p>
          <button onClick={logout} className="mt-3 inline-flex items-center gap-1.5 text-sand-600 hover:text-brand-600">
            <LogOut className="size-3.5" aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-sand-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <nav className="flex gap-1 overflow-x-auto lg:hidden" aria-label="Seções">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cx(
                    "inline-flex size-9 items-center justify-center rounded-lg",
                    (item.exact ? pathname === item.href : pathname.startsWith(item.href)) ? "bg-brand-50 text-brand-600" : "text-sand-500",
                  )}
                >
                  <item.icon className="size-4" />
                </Link>
              ))}
            </nav>
            <StatusPill />
          </div>
          <Button icon={MonitorPlay} onClick={() => setPreviewOpen(true)}>
            <span className="hidden sm:inline">Pré-visualizar</span>
          </Button>
          <Button icon={UploadCloud} onClick={() => void save()} disabled={!dirty || busy}>
            <span className="hidden sm:inline">Salvar rascunho</span>
          </Button>
          <Button variant="primary" onClick={() => void publish()} disabled={busy || !unpublished} loading={busy}>
            Publicar alterações
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-7 sm:px-8">{children}</main>
      </div>
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
