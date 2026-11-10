"use client";

import { Archive, ArchiveRestore, Crosshair, FileSearch, Images, ShieldAlert, ShieldCheck, Trash2, Upload, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { MediaThumb } from "@/components/admin/MediaPicker";
import { UploadPanel } from "@/components/admin/UploadPanel";
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Segmented,
  Select,
  Switch,
  Textarea,
  useFeedback,
} from "@/components/admin/ui";
import { api, jsonInit } from "@/lib/client/api";
import { formatBytes } from "@/lib/client/upload";
import { CONSENT_STATUSES, MEDIA_CATEGORIES, type Media, type MediaCategory } from "@/lib/schema";
import { MEDIA_CATEGORY_LABEL, newId } from "@/lib/slide-meta";

const CONSENT_LABEL: Record<(typeof CONSENT_STATUSES)[number], string> = {
  pending: "Autorização pendente",
  authorized: "Uso autorizado",
  denied: "Uso não autorizado",
};

export default function MidiasPage() {
  const { draft } = useDraft();
  const [showUpload, setShowUpload] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MediaCategory | "">("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [onlyPending, setOnlyPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [orphansOpen, setOrphansOpen] = useState(false);

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of draft.slides) {
      const d = s.data as Record<string, unknown>;
      for (const k of ["mediaId", "composedMediaId", "beforeMediaId", "afterMediaId", "posterMediaId"]) {
        const id = d[k];
        if (typeof id === "string") map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    for (const id of [draft.settings.fallback.mediaId, draft.settings.logoDarkMediaId, draft.settings.logoLightMediaId])
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [draft]);

  const list = draft.media.filter(
    (m) =>
      m.status === status &&
      (!cat || m.category === cat) &&
      (!onlyPending || (m.clinical.isClinical && m.clinical.consent !== "authorized")) &&
      `${m.name} ${m.procedure ?? ""} ${m.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );
  const pendingCount = draft.media.filter(
    (m) => m.status === "active" && m.clinical.isClinical && m.clinical.consent !== "authorized",
  ).length;

  return (
    <>
      <PageHeader
        title="Mídias"
        description="Biblioteca de imagens e vídeos. As imagens são otimizadas no navegador antes do envio e gravadas no repositório."
        actions={
          <>
            <Button icon={FileSearch} onClick={() => setOrphansOpen(true)}>
              Arquivos sem cadastro
            </Button>
            <Button variant="primary" icon={Upload} onClick={() => setShowUpload((v) => !v)}>
              Enviar arquivos
            </Button>
          </>
        }
      />

      {showUpload && (
        <Card
          className="mb-6"
          title="Enviar arquivos"
          description="Arraste vários arquivos de uma vez. Cada envio é gravado em um único commit."
        >
          <UploadPanel onUploaded={() => setShowUpload(false)} />
        </Card>
      )}

      {pendingCount > 0 && (
        <div className="mb-5">
          <Notice
            tone="amber"
            icon={ShieldAlert}
            title={`${pendingCount} fotografia(s) clínica(s) aguardando registro de autorização.`}
            action={
              <Button size="sm" onClick={() => setOnlyPending(true)}>
                Ver pendentes
              </Button>
            }
          >
            Elas não aparecem na TV até que a autorização de uso seja registrada.
          </Notice>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nome, procedimento ou etiqueta…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={cat} onChange={(e) => setCat(e.target.value as MediaCategory | "")} className="w-52">
          <option value="">Todas as categorias</option>
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {MEDIA_CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Ativas" },
            { value: "archived", label: "Arquivadas" },
          ]}
        />
        <Switch checked={onlyPending} onChange={setOnlyPending} label="Somente autorização pendente" />
        <span className="ml-auto text-[13px] text-sand-500">{list.length} arquivo(s)</span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Nenhuma mídia encontrada"
          action={
            <Button variant="primary" icon={Upload} onClick={() => setShowUpload(true)}>
              Enviar arquivos
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m.id)}
              className="group rounded-xl border border-sand-200 bg-white p-2 text-left transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-sand-100">
                <MediaThumb media={m} fit={m.hasText ? "contain" : "cover"} />
                {m.kind === "video" && <Video className="absolute top-2 right-2 size-4 text-white drop-shadow" />}
              </div>
              <p className="mt-2 line-clamp-2 text-[12.5px] font-semibold text-sand-900">{m.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge>{MEDIA_CATEGORY_LABEL[m.category]}</Badge>
                {m.clinical.isClinical && (
                  <Badge tone={m.clinical.consent === "authorized" ? "green" : m.clinical.consent === "denied" ? "red" : "amber"}>
                    {CONSENT_LABEL[m.clinical.consent]}
                  </Badge>
                )}
                {usage.get(m.id) ? <Badge tone="blue">Em {usage.get(m.id)} peça(s)</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <MediaDetails id={selected} usage={selected ? (usage.get(selected) ?? 0) : 0} onClose={() => setSelected(null)} />
      <OrphansDialog open={orphansOpen} onClose={() => setOrphansOpen(false)} />
    </>
  );
}

function MediaDetails({ id, usage, onClose }: { id: string | null; usage: number; onClose: () => void }) {
  const { draft, update, mediaUrl, save } = useDraft();
  const { confirm, toast } = useFeedback();
  const m = draft.media.find((x) => x.id === id);
  const patch = (fn: (x: Media) => void) =>
    update((d) => {
      const x = d.media.find((y) => y.id === id);
      if (x) {
        fn(x);
        x.updatedAt = new Date().toISOString();
      }
    });

  const removeForever = async () => {
    if (!m) return;
    const ok = await confirm({
      title: "Excluir definitivamente?",
      danger: true,
      confirmLabel: "Excluir arquivo",
      message:
        "O cadastro e o arquivo serão removidos do repositório (o rascunho é salvo antes). Se esta mídia já foi publicada, publique a programação sem ela antes de excluir. O histórico do Git mantém versões antigas.",
    });
    if (!ok) return;
    const paths = [m.path, ...(m.originalPath ? [m.originalPath] : [])];
    update((d) => {
      d.media = d.media.filter((x) => x.id !== m.id);
    });
    onClose();
    // Aguarda o React aplicar a remoção antes de salvar.
    await new Promise((r) => setTimeout(r, 50));
    const saved = await save({ silent: true });
    if (!saved) return;
    try {
      await api("/api/admin/media", jsonInit("DELETE", { paths }));
      toast("Arquivo excluído do repositório.");
    } catch (e) {
      toast(`Cadastro removido, mas o arquivo não foi excluído: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  return (
    <Modal
      open={!!m}
      onClose={onClose}
      title={m?.name ?? ""}
      description={m ? `${m.width}×${m.height} · ${formatBytes(m.bytes)} · ${m.mime}` : ""}
      side
    >
      {m && (
        <div className="space-y-6">
          <FocalPicker media={m} url={mediaUrl(m)} onChange={(x, y) => patch((v) => ((v.focalX = x), (v.focalY = y)))} />

          <div className="grid gap-4">
            <Field label="Nome">
              <Input value={m.name} maxLength={160} onChange={(e) => patch((v) => (v.name = e.target.value))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <Select value={m.category} onChange={(e) => patch((v) => (v.category = e.target.value as MediaCategory))}>
                  {MEDIA_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {MEDIA_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Procedimento">
                <Input
                  value={m.procedure ?? ""}
                  maxLength={120}
                  onChange={(e) => patch((v) => (v.procedure = e.target.value || undefined))}
                />
              </Field>
            </div>
            <Field label="Etiquetas" hint="Separadas por vírgula. Ex.: black friday, face">
              <Input
                value={m.tags.join(", ")}
                onChange={(e) =>
                  patch(
                    (v) =>
                      (v.tags = e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 20)),
                  )
                }
              />
            </Field>
            <Switch
              checked={m.hasText}
              onChange={(v) => patch((x) => (x.hasText = v))}
              label="Arte com textos"
              description="Sempre exibida inteira; o zoom fotográfico fica desativado."
            />
          </div>

          <section className="rounded-xl border border-sand-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-sand-900">
              <ShieldCheck className="size-4 text-brand-500" /> Autorização de uso de imagem
            </h3>
            <div className="mt-3 space-y-4">
              <Switch
                checked={m.clinical.isClinical}
                onChange={(v) => patch((x) => (x.clinical.isClinical = v))}
                label="Fotografia de paciente / resultado clínico"
                description="Exige autorização registrada para ir à TV."
              />
              {m.clinical.isClinical && (
                <>
                  <Field label="Situação">
                    <Select
                      value={m.clinical.consent}
                      onChange={(e) => patch((x) => (x.clinical.consent = e.target.value as Media["clinical"]["consent"]))}
                    >
                      {CONSENT_STATUSES.map((c) => (
                        <option key={c} value={c}>
                          {CONSENT_LABEL[c]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Referência do termo"
                    hint="Número, pasta ou link interno do documento assinado. Uso interno — não aparece na TV."
                  >
                    <Input
                      value={m.clinical.consentRef ?? ""}
                      maxLength={300}
                      onChange={(e) => patch((x) => (x.clinical.consentRef = e.target.value || undefined))}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Revisado/aprovado por">
                      <Input
                        value={m.clinical.reviewedBy ?? ""}
                        maxLength={120}
                        onChange={(e) => patch((x) => (x.clinical.reviewedBy = e.target.value || undefined))}
                      />
                    </Field>
                    <Field label="Data da aprovação">
                      <Input
                        type="date"
                        value={m.clinical.reviewedAt ?? ""}
                        onChange={(e) => patch((x) => (x.clinical.reviewedAt = e.target.value || undefined))}
                      />
                    </Field>
                  </div>
                  <Field label="Observações internas">
                    <Textarea
                      rows={2}
                      value={m.clinical.notes ?? ""}
                      maxLength={2000}
                      onChange={(e) => patch((x) => (x.clinical.notes = e.target.value || undefined))}
                    />
                  </Field>
                  {m.clinical.consent !== "authorized" && (
                    <Notice tone="amber" icon={ShieldAlert}>
                      Enquanto a situação não for “Uso autorizado”, as peças que usam esta fotografia não aparecem na TV.
                    </Notice>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="space-y-1 text-xs text-sand-500">
            <p>
              Arquivo: <code className="text-sand-700">public/{m.path}</code>
            </p>
            {m.originalPath && (
              <p>
                Original preservado: <code className="text-sand-700">{m.originalPath}</code>
              </p>
            )}
            <p>Enviado em {new Date(m.createdAt).toLocaleString("pt-BR")}</p>
            <p>{usage ? `Usado em ${usage} peça(s)/configuração(ões).` : "Não está em uso."}</p>
          </section>

          <div className="flex flex-wrap gap-2 border-t border-sand-200 pt-4">
            {m.status === "active" ? (
              <Button icon={Archive} onClick={() => patch((x) => (x.status = "archived"))}>
                Arquivar
              </Button>
            ) : (
              <Button icon={ArchiveRestore} onClick={() => patch((x) => (x.status = "active"))}>
                Restaurar
              </Button>
            )}
            <Button
              variant="danger"
              icon={Trash2}
              disabled={usage > 0}
              title={usage > 0 ? "Remova a mídia das peças antes de excluir" : undefined}
              onClick={() => void removeForever()}
            >
              Excluir definitivamente
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Ajuste de enquadramento: clique no ponto de interesse da foto. */
function FocalPicker({ media, url, onChange }: { media: Media; url: string; onChange: (x: number, y: number) => void }) {
  if (media.kind === "video") {
    return <video src={url} controls muted className="w-full rounded-lg bg-black" />;
  }
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-sand-800">
        <Crosshair className="size-3.5 text-brand-500" /> Enquadramento
        <span className="font-normal text-sand-500">
          — clique no ponto principal da foto (usado quando a imagem precisa ser recortada em molduras).
        </span>
      </p>
      <div className="flex gap-3">
        <div
          className="relative flex-1 cursor-crosshair overflow-hidden rounded-lg bg-sand-100"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onChange(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="block h-auto w-full" draggable={false} />
          <span
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(169,83,47,0.9)]"
            style={{ left: `${media.focalX}%`, top: `${media.focalY}%` }}
          />
        </div>
        {!media.hasText && (
          <div className="flex w-24 shrink-0 flex-col gap-2">
            {[
              ["aspect-[9/16]", "9:16"],
              ["aspect-square", "1:1"],
              ["aspect-[16/9]", "16:9"],
            ].map(([cls, label]) => (
              <div key={label}>
                <div className={cx("overflow-hidden rounded-md bg-sand-100", cls)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="size-full object-cover"
                    style={{ objectPosition: `${media.focalX}% ${media.focalY}%` }}
                  />
                </div>
                <p className="mt-0.5 text-center text-[10px] text-sand-500">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrphansDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update, mediaUrl } = useDraft();
  const { toast } = useFeedback();
  const [state, setState] = useState<{ loading: boolean; orphans: { path: string; size: number }[]; error?: string }>({
    loading: false,
    orphans: [],
  });

  const load = async () => {
    setState({ loading: true, orphans: [] });
    try {
      const res = await api<{ orphans: { path: string; size: number }[] }>("/api/admin/media/orphans");
      setState({ loading: false, orphans: res.orphans });
    } catch (e) {
      setState({ loading: false, orphans: [], error: e instanceof Error ? e.message : String(e) });
    }
  };

  const register = async (o: { path: string; size: number }) => {
    const isVideo = /\.(mp4|webm)$/i.test(o.path);
    const fake = { storage: "repo", path: o.path } as Media;
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      if (isVideo) {
        const v = document.createElement("video");
        v.onloadedmetadata = () => resolve({ w: v.videoWidth || 1080, h: v.videoHeight || 1920 });
        v.onerror = () => resolve({ w: 1080, h: 1920 });
        v.src = mediaUrl(fake);
        return;
      }
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1080, h: 1920 });
      img.src = mediaUrl(fake);
    });
    const now = new Date().toISOString();
    const ext = o.path.split(".").pop()!.toLowerCase();
    update((d) => {
      d.media.unshift({
        id: newId("med"),
        kind: isVideo ? "video" : "image",
        storage: "repo",
        path: o.path,
        name: o.path
          .split("/")
          .pop()!
          .replace(/-[a-z0-9]{6}\.[a-z0-9]+$/i, "")
          .replace(/[-_]+/g, " "),
        category: "outro",
        tags: [],
        width: dims.w,
        height: dims.h,
        bytes: o.size,
        mime: isVideo ? `video/${ext}` : `image/${ext === "jpg" ? "jpeg" : ext}`,
        hasText: false,
        focalX: 50,
        focalY: 50,
        status: "active",
        clinical: { isClinical: false, consent: "pending" },
        createdAt: now,
        updatedAt: now,
      });
    });
    setState((s) => ({ ...s, orphans: s.orphans.filter((x) => x.path !== o.path) }));
    toast("Arquivo cadastrado na biblioteca. Revise a categoria e a autorização.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Arquivos sem cadastro"
      description="Arquivos presentes em public/media que não constam na biblioteca (ex.: envio interrompido)."
    >
      <div className="space-y-4">
        <Button icon={FileSearch} loading={state.loading} onClick={() => void load()}>
          Verificar repositório
        </Button>
        {state.error && <Notice tone="red">{state.error}</Notice>}
        {!state.loading && state.orphans.length === 0 && (
          <p className="text-sm text-sand-500">Nenhum arquivo pendente encontrado (clique em verificar).</p>
        )}
        <ul className="divide-y divide-sand-200">
          {state.orphans.map((o) => (
            <li key={o.path} className="flex items-center gap-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">{o.path}</code>
              <span className="text-xs text-sand-500">{formatBytes(o.size)}</span>
              <Button size="sm" onClick={() => void register(o)}>
                Cadastrar
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
