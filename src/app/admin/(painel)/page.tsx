"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Images,
  ListVideo,
  Megaphone,
  MonitorPlay,
  Radio,
  Store as StoreIcon,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { PHASE_TONE } from "@/components/admin/labels";
import { PreviewDialog } from "@/components/admin/PreviewDialog";
import { Badge, Button, Card, cx, Notice, PageHeader } from "@/components/admin/ui";
import { CAMPAIGN_PHASE_LABEL, campaignPhase, describeSchedule, localParts, type CampaignPhase } from "@/lib/schedule";

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Megaphone;
  label: string;
  value: number | string;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-sand-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-sand-500">{label}</span>
        <Icon className="size-4 text-sand-400 group-hover:text-brand-500" aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-sand-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-sand-500">{hint}</p>}
    </Link>
  );
}

export default function DashboardPage() {
  const { draft, deployed, issues, publishState, storage, statusLabel, status, unpublished } = useDraft();
  const [previewUnit, setPreviewUnit] = useState<string | null>(null);
  const parts = useMemo(() => localParts(new Date(), draft.settings.timezone), [draft.settings.timezone]);

  const phases = draft.campaigns.map((c) => ({ c, phase: campaignPhase(c, parts) }));
  const live = phases.filter((p) => p.phase === "live" || p.phase === "waiting");
  const scheduled = phases.filter((p) => p.phase === "scheduled");
  const activeMedia = draft.media.filter((m) => m.status === "active").length;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const last = draft.meta.lastPublish;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <PageHeader
        title="Painel"
        description="Visão geral da comunicação nas TVs das unidades Prime Esthetics."
        actions={
          <Link href="/admin/programacao">
            <Button variant="dark" icon={ListVideo}>
              Editar programação
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          icon={Megaphone}
          label="Campanhas"
          value={draft.campaigns.filter((c) => c.status !== "archived").length}
          hint={`${draft.campaigns.length} no total`}
          href="/admin/campanhas"
        />
        <Kpi icon={Radio} label="Ativas agora" value={live.length} hint="em exibição ou no período" href="/admin/campanhas" />
        <Kpi icon={CalendarClock} label="Programadas" value={scheduled.length} hint="início futuro" href="/admin/campanhas" />
        <Kpi
          icon={Images}
          label="Mídias"
          value={activeMedia}
          hint={`${draft.media.length - activeMedia} arquivada(s)`}
          href="/admin/midias"
        />
        <Kpi
          icon={StoreIcon}
          label="Unidades"
          value={draft.units.filter((u) => u.active).length}
          hint={`${draft.units.length} cadastrada(s)`}
          href="/admin/unidades"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card title="Unidades e telas" description="Acesse a programação e o link de reprodução de cada TV.">
            <ul className="divide-y divide-sand-200">
              {draft.units.map((u) => {
                const pl = draft.playlists.find((p) => p.id === u.playlistId);
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={cx("size-2 rounded-full", u.active ? "bg-emerald-500" : "bg-sand-300")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sand-900">{u.name}</p>
                      <p className="truncate text-xs text-sand-500">
                        /tv/{u.code} · {u.orientation === "portrait" ? "Vertical" : "Horizontal"} · {pl?.name ?? "sem programação"} (
                        {pl?.items.length ?? 0} itens)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/admin/programacao?unidade=${u.code}`}>
                        <Button size="sm" icon={ListVideo}>
                          Programação
                        </Button>
                      </Link>
                      <Button size="sm" icon={MonitorPlay} onClick={() => setPreviewUnit(u.id)}>
                        Prévia
                      </Button>
                      <a href={`${origin}/tv/${u.code}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" icon={ExternalLink}>
                          Abrir TV
                        </Button>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Campanhas em destaque" description={`Horário de referência: ${parts.time} (${draft.settings.timezone})`}>
            {phases.filter((p) => p.phase !== "archived").length === 0 ? (
              <p className="text-sm text-sand-500">Nenhuma campanha cadastrada.</p>
            ) : (
              <ul className="space-y-2">
                {phases
                  .filter((p) => p.phase !== "archived")
                  .sort((a, b) => order(a.phase) - order(b.phase))
                  .slice(0, 6)
                  .map(({ c, phase }) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-lg border border-sand-200 px-3 py-2">
                      <Badge tone={PHASE_TONE[phase]}>{CAMPAIGN_PHASE_LABEL[phase]}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                      <span className="hidden truncate text-xs text-sand-500 md:block">{describeSchedule(c.schedule)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Última publicação">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-sand-500">Situação</span>
                <Badge tone={status === "published" ? "green" : status === "error" ? "red" : status === "dirty" ? "amber" : "violet"}>
                  {statusLabel}
                </Badge>
              </div>
              <Row label="Versão no ar" value={deployed.version} mono />
              {last && <Row label="Última publicada" value={`${last.version}`} mono />}
              {last && (
                <Row label="Publicada em" value={`${new Date(last.at).toLocaleString("pt-BR")}${last.by ? ` por ${last.by}` : ""}`} />
              )}
              {storage.kind === "github" && deployed.commit && (
                <Row
                  label="Commit do deploy"
                  value={
                    <a
                      className="font-mono text-brand-600 underline"
                      href={`${storage.commitUrlBase}${deployed.commit}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {deployed.commit.slice(0, 7)}
                    </a>
                  }
                />
              )}
              {publishState?.message && (
                <Notice
                  tone={
                    publishState.phase === "error" || publishState.phase === "timeout"
                      ? "red"
                      : publishState.phase === "published"
                        ? "green"
                        : "blue"
                  }
                >
                  {publishState.message}
                  {publishState.targetUrl && (
                    <a href={publishState.targetUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                      Ver detalhes
                    </a>
                  )}
                </Notice>
              )}
              {unpublished && status !== "dirty" && (
                <p className="text-xs text-sand-500">Há alterações salvas no rascunho que ainda não estão nas TVs.</p>
              )}
            </div>
          </Card>

          <Card title="Verificação da programação" description="Erros bloqueiam a publicação; avisos merecem atenção.">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> Tudo certo com o rascunho.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...errors, ...warnings].slice(0, 12).map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed">
                    {i.level === "error" ? (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    )}
                    {i.href ? (
                      <Link href={i.href} className="text-sand-700 hover:text-brand-600 hover:underline">
                        {i.message}
                      </Link>
                    ) : (
                      <span className="text-sand-700">{i.message}</span>
                    )}
                  </li>
                ))}
                {issues.length > 12 && <li className="text-xs text-sand-500">… e mais {issues.length - 12}.</li>}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <PreviewDialog open={!!previewUnit} onClose={() => setPreviewUnit(null)} initialUnitId={previewUnit ?? undefined} />
    </>
  );
}

function order(p: CampaignPhase) {
  return ["live", "waiting", "scheduled", "paused", "draft", "ended", "archived"].indexOf(p);
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sand-500">{label}</span>
      <span className={cx("truncate text-right text-sand-800", mono && "font-mono text-[12.5px]")}>{value}</span>
    </div>
  );
}
