"use client";

import {
  Check,
  Copy,
  ExternalLink,
  ListVideo,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { PreviewDialog } from "@/components/admin/PreviewDialog";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  NumberInput,
  PageHeader,
  Segmented,
  Select,
  Switch,
  Textarea,
  useFeedback,
} from "@/components/admin/ui";
import { formatPhone } from "@/lib/manifest";
import { UnitSchema, type Unit } from "@/lib/schema";
import { newId } from "@/lib/slide-meta";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

type PlaylistChoice = { mode: "existing"; id: string } | { mode: "new-empty" } | { mode: "copy"; from: string };

export default function UnidadesPage() {
  const { draft, update } = useDraft();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState<Unit | "new" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const remove = async (u: Unit) => {
    const ok = await confirm({
      title: `Excluir "${u.name}"?`,
      danger: true,
      confirmLabel: "Excluir unidade",
      message: "A TV dessa unidade passará a exibir a tela de contingência após a publicação. As programações e peças não são apagadas.",
    });
    if (!ok) return;
    update((d) => {
      d.units = d.units.filter((x) => x.id !== u.id);
      for (const c of d.campaigns) c.unitIds = c.unitIds.filter((x) => x !== u.id);
    });
    toast("Unidade removida do rascunho.");
  };

  return (
    <>
      <PageHeader
        title="Unidades"
        description="Cada unidade tem seu link de reprodução, orientação da TV, contato e programação."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
            Nova unidade
          </Button>
        }
      />
      {draft.units.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Nenhuma unidade"
          action={
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              Nova unidade
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.units.map((u) => {
            const pl = draft.playlists.find((p) => p.id === u.playlistId);
            const url = `${origin}/tv/${u.code}`;
            return (
              <div key={u.id} className="rounded-xl border border-sand-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[16px] font-semibold text-sand-900">{u.name}</h3>
                      <Badge tone={u.active ? "green" : "neutral"}>{u.active ? "Ativa" : "Inativa"}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-sand-500">
                      {u.orientation === "portrait" ? "TV vertical (9:16)" : "TV horizontal (16:9)"}
                      {u.rotation ? ` · rotação ${u.rotation}°` : ""} · {pl?.name ?? "sem programação"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" icon={Pencil} onClick={() => setEditing(u)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label="Excluir" onClick={() => void remove(u)} />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-[13px] text-sand-700">
                  <p className="flex items-center gap-2">
                    <MessageCircle className="size-3.5 text-sand-400" />
                    {u.whatsapp ? formatPhone(u.whatsapp) : <span className="text-sand-400">WhatsApp não informado</span>}
                  </p>
                  {u.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-sand-400" /> {u.address}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-sand-50 p-2 pl-3">
                  <code className="min-w-0 flex-1 truncate text-[12.5px] text-sand-700">{url}</code>
                  <Button
                    size="sm"
                    icon={copied === u.id ? Check : Copy}
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      setCopied(u.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  >
                    {copied === u.id ? "Copiado" : "Copiar link"}
                  </Button>
                  <a href={url} target="_blank" rel="noreferrer">
                    <Button size="sm" icon={ExternalLink}>
                      Abrir TV
                    </Button>
                  </a>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/admin/programacao?unidade=${u.code}`}>
                    <Button size="sm" variant="ghost" icon={ListVideo}>
                      Programação
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" icon={MonitorPlay} onClick={() => setPreview(u.id)}>
                    Pré-visualizar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-6" />
      <Notice tone="neutral" icon={ExternalLink} title="Como colocar na TV">
        Abra o link da unidade no navegador da TV (ou no dispositivo conectado a ela) em tela cheia. A apresentação começa sozinha, atualiza
        a programação automaticamente e continua funcionando mesmo com quedas de internet. Novas unidades passam a funcionar após publicar
        as alterações.
      </Notice>
      <UnitForm unit={editing} onClose={() => setEditing(null)} />
      <PreviewDialog open={!!preview} onClose={() => setPreview(null)} initialUnitId={preview ?? undefined} />
    </>
  );
}

function UnitForm({ unit, onClose }: { unit: Unit | "new" | null; onClose: () => void }) {
  const { draft, update } = useDraft();
  const { toast } = useFeedback();
  const isNew = unit === "new";
  const [form, setForm] = useState<Unit | null>(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [playlistChoice, setPlaylistChoice] = useState<PlaylistChoice>({ mode: "existing", id: draft.playlists[0]?.id ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [openedFor, setOpenedFor] = useState<Unit | "new" | null>(null);
  // Reinicia o formulário somente ao abrir outra unidade (estado derivado).
  if (openedFor !== unit) {
    setOpenedFor(unit);
    setErrors({});
    if (!unit) setForm(null);
    else if (unit === "new") {
      setCodeTouched(false);
      const base = draft.playlists[0]?.id ?? "";
      setPlaylistChoice(base ? { mode: "copy", from: base } : { mode: "new-empty" });
      setForm({
        id: newId("un"),
        code: "",
        name: "",
        orientation: "portrait",
        rotation: 0,
        overscanPercent: 0,
        playlistId: base,
        fallbackPlaylistId: draft.playlists.find((p) => p.id === "pl_institucional")?.id,
        autoCampaignEvery: 4,
        active: true,
      });
    } else {
      setCodeTouched(true);
      setPlaylistChoice({ mode: "existing", id: unit.playlistId });
      setForm(structuredClone(unit));
    }
  }

  if (!form)
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );

  const set = (patch: Partial<Unit>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const apply = () => {
    const errs: Record<string, string> = {};
    const candidate: Unit = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      address: form.address?.trim() || undefined,
      whatsapp: form.whatsapp?.replace(/\D/g, "") || undefined,
      whatsappMessage: form.whatsappMessage?.trim() || undefined,
      ctaMessage: form.ctaMessage?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    if (playlistChoice.mode === "existing") candidate.playlistId = playlistChoice.id;
    const parsed = UnitSchema.safeParse({ ...candidate, playlistId: candidate.playlistId || "pending" });
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
    if (draft.units.some((u) => u.code === candidate.code && u.id !== candidate.id)) errs.code = "Já existe uma unidade com este código.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    update((d) => {
      if (playlistChoice.mode !== "existing") {
        const plId = newId("pl");
        const src = playlistChoice.mode === "copy" ? d.playlists.find((p) => p.id === playlistChoice.from) : undefined;
        d.playlists.push({
          id: plId,
          name: `${candidate.name} — programação`,
          description: src ? `Criada a partir de "${src.name}".` : "",
          items: src ? src.items.map((it) => ({ ...structuredClone(it), id: newId("it") })) : [],
        });
        candidate.playlistId = plId;
      }
      const idx = d.units.findIndex((u) => u.id === candidate.id);
      if (idx >= 0) d.units[idx] = candidate;
      else d.units.push(candidate);
    });
    toast(isNew ? "Unidade criada. Publique para ativar o link da TV." : "Unidade atualizada.");
    onClose();
  };

  const original = unit && unit !== "new" ? unit : null;
  return (
    <Modal
      open={!!unit}
      onClose={onClose}
      side
      title={isNew ? "Nova unidade" : `Editar ${original?.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={apply}>
            {isNew ? "Criar unidade" : "Aplicar alterações"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nome" error={errors.name}>
          <Input
            value={form.name}
            maxLength={120}
            placeholder="Ex.: Unidade Barra"
            onChange={(e) => set({ name: e.target.value, ...(codeTouched ? {} : { code: slugify(e.target.value) }) })}
          />
        </Field>
        <Field label="Código (link da TV)" error={errors.code} hint={`Endereço: /tv/${form.code || "codigo-da-unidade"}`}>
          <Input
            value={form.code}
            maxLength={48}
            onChange={(e) => {
              setCodeTouched(true);
              set({ code: e.target.value.toLowerCase() });
            }}
          />
        </Field>
        {original && original.code !== form.code && (
          <Notice tone="amber">Alterar o código muda o link: a TV que usa o link antigo passará a mostrar a tela de contingência.</Notice>
        )}
        <Field label="Endereço" hint="Opcional">
          <Input value={form.address ?? ""} maxLength={300} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" error={errors.whatsapp} hint="DDI + DDD + número, ex.: 5571999998888">
            <Input
              inputMode="tel"
              value={form.whatsapp ?? ""}
              maxLength={20}
              onChange={(e) => set({ whatsapp: e.target.value.replace(/[^\d]/g, "") })}
            />
          </Field>
          <Field label="Mensagem inicial do WhatsApp" hint="Texto que já aparece na conversa ao ler o QR Code">
            <Input
              value={form.whatsappMessage ?? ""}
              maxLength={300}
              placeholder="Olá! Vi a TV da Prime e gostaria de agendar uma avaliação."
              onChange={(e) => set({ whatsappMessage: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Mensagem personalizada da unidade" hint="Substitui o texto das peças de chamada para ação nesta unidade (opcional).">
          <Input value={form.ctaMessage ?? ""} maxLength={200} onChange={(e) => set({ ctaMessage: e.target.value })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Orientação da TV">
            <Segmented
              value={form.orientation}
              onChange={(v) => set({ orientation: v })}
              options={[
                { value: "portrait", label: "Vertical" },
                { value: "landscape", label: "Horizontal" },
              ]}
            />
          </Field>
          <Field label="Rotação da imagem" hint="Use se a TV está em pé mas o navegador mostra a imagem deitada.">
            <Select value={form.rotation} onChange={(e) => set({ rotation: Number(e.target.value) as Unit["rotation"] })}>
              <option value={0}>Sem rotação</option>
              <option value={90}>90° (horário)</option>
              <option value={270}>90° (anti-horário)</option>
              <option value={180}>180°</option>
            </Select>
          </Field>
          <Field label="Margem de segurança (overscan)" hint="0 a 8%. Aumente se a TV cortar as bordas.">
            <NumberInput
              value={form.overscanPercent}
              min={0}
              max={8}
              step={0.5}
              suffix="%"
              onChange={(v) => set({ overscanPercent: v ?? 0 })}
            />
          </Field>
          <Field label="Inserir campanhas a cada" hint="Se a programação não tiver espaços de campanha. 0 = não inserir.">
            <NumberInput
              value={form.autoCampaignEvery}
              min={0}
              max={20}
              suffix="peças"
              onChange={(v) => set({ autoCampaignEvery: Math.round(v ?? 0) })}
            />
          </Field>
        </div>

        <Field label="Programação">
          <Select
            value={
              playlistChoice.mode === "existing"
                ? playlistChoice.id
                : playlistChoice.mode === "copy"
                  ? `copy:${playlistChoice.from}`
                  : "new"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "new") setPlaylistChoice({ mode: "new-empty" });
              else if (v.startsWith("copy:")) setPlaylistChoice({ mode: "copy", from: v.slice(5) });
              else setPlaylistChoice({ mode: "existing", id: v });
            }}
          >
            <optgroup label="Usar uma programação existente (compartilhada)">
              {draft.playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Criar programação exclusiva">
              {draft.playlists.map((p) => (
                <option key={`copy-${p.id}`} value={`copy:${p.id}`}>
                  Cópia de “{p.name}”
                </option>
              ))}
              <option value="new">Programação vazia</option>
            </optgroup>
          </Select>
        </Field>
        <Field label="Programação institucional padrão" hint="Usada automaticamente se a programação principal ficar sem peças exibíveis.">
          <Select value={form.fallbackPlaylistId ?? ""} onChange={(e) => set({ fallbackPlaylistId: e.target.value || undefined })}>
            <option value="">Nenhuma (tela de contingência)</option>
            {draft.playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Switch
          checked={form.active}
          onChange={(v) => set({ active: v })}
          label="Unidade ativa"
          description="Unidades inativas exibem apenas a tela institucional de contingência."
        />
        <Field label="Observações internas">
          <Textarea rows={2} value={form.notes ?? ""} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
