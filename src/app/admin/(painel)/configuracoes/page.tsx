"use client";

import { CheckCircle2, Info, ListVideo, RefreshCw, Server, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/admin/DraftProvider";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Button, Card, Field, IconButton, Input, Notice, NumberInput, PageHeader, Select, useFeedback } from "@/components/admin/ui";
import { api } from "@/lib/client/api";
import { isValidTimeZone } from "@/lib/schedule";
import { SettingsSchema, TRANSITIONS, type Settings, type Transition } from "@/lib/schema";
import { TRANSITION_LABEL } from "@/lib/slide-meta";

const TIMEZONES = [
  "America/Bahia",
  "America/Sao_Paulo",
  "America/Recife",
  "America/Fortaleza",
  "America/Belem",
  "America/Maceio",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
];

export default function ConfiguracoesPage() {
  const { draft, update, storage, deployed } = useDraft();
  const { toast, confirm } = useFeedback();
  const [form, setForm] = useState<Settings>(() => structuredClone(draft.settings));
  const [errors, setErrors] = useState<string[]>([]);
  const [health, setHealth] = useState<{ checks: { label: string; ok: boolean; detail?: string }[] } | null>(null);
  const [checking, setChecking] = useState(false);

  // Recarrega o formulário somente quando as configurações realmente mudarem no rascunho.
  const settingsKey = JSON.stringify(draft.settings);
  const [loadedKey, setLoadedKey] = useState(settingsKey);
  if (loadedKey !== settingsKey) {
    setLoadedKey(settingsKey);
    setForm(JSON.parse(settingsKey) as Settings);
  }
  const changed = useMemo(() => JSON.stringify(form) !== JSON.stringify(draft.settings), [form, draft.settings]);

  const set = (patch: Partial<Settings>) => setForm((f) => ({ ...f, ...patch }));

  const apply = () => {
    const candidate: Settings = {
      ...form,
      contact: {
        whatsapp: form.contact.whatsapp?.replace(/\D/g, "") || undefined,
        whatsappMessage: form.contact.whatsappMessage?.trim() || undefined,
        instagram: form.contact.instagram?.trim() || undefined,
        website: form.contact.website?.trim() || undefined,
      },
    };
    const errs: string[] = [];
    const parsed = SettingsSchema.safeParse(candidate);
    if (!parsed.success) for (const i of parsed.error.issues) errs.push(`${i.path.join(" › ")}: ${i.message}`);
    if (!isValidTimeZone(candidate.timezone)) errs.push("Fuso horário inválido.");
    setErrors(errs);
    if (errs.length) return;
    update((d) => {
      d.settings = candidate;
    });
    toast("Configurações aplicadas ao rascunho. Salve ou publique para valer nas TVs.");
  };

  const check = async () => {
    setChecking(true);
    try {
      setHealth(await api("/api/admin/health"));
    } catch (e) {
      setHealth({ checks: [{ label: "Diagnóstico", ok: false, detail: e instanceof Error ? e.message : String(e) }] });
    } finally {
      setChecking(false);
    }
  };

  const usedPlaylists = new Set(draft.units.flatMap((u) => [u.playlistId, u.fallbackPlaylistId].filter(Boolean) as string[]));

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Elementos institucionais, tempos padrão, tela de contingência e opções de apresentação."
        actions={
          <>
            <Button disabled={!changed} onClick={() => setForm(structuredClone(draft.settings))}>
              Descartar
            </Button>
            <Button variant="primary" disabled={!changed} onClick={apply}>
              Aplicar configurações
            </Button>
          </>
        }
      />
      {errors.length > 0 && (
        <div className="mb-5">
          <Notice tone="red" title="Corrija os campos abaixo">
            <ul className="list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Marca" description="Prime Esthetics · Estética Avançada">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da marca">
                <Input value={form.brandName} maxLength={80} onChange={(e) => set({ brandName: e.target.value })} />
              </Field>
              <Field label="Complemento">
                <Input value={form.tagline} maxLength={80} onChange={(e) => set({ tagline: e.target.value })} />
              </Field>
            </div>
            <Notice tone="amber" icon={Info}>
              O logotipo atual foi extraído provisoriamente das artes de referência. Envie o arquivo oficial (PNG com fundo transparente, ao
              menos 1600 px de largura) e selecione abaixo — versão clara para fundos escuros e versão escura para fundos claros.
            </Notice>
            <div className="grid gap-4 sm:grid-cols-2">
              <MediaPicker
                label="Logotipo claro (fundos escuros)"
                optional
                value={form.logoLightMediaId}
                onChange={(id) => set({ logoLightMediaId: id })}
                uploadCategory="marca"
              />
              <MediaPicker
                label="Logotipo escuro (fundos claros)"
                optional
                value={form.logoDarkMediaId}
                onChange={(id) => set({ logoDarkMediaId: id })}
                uploadCategory="marca"
              />
            </div>
          </div>
        </Card>

        <Card title="Apresentação" description="Valores padrão para novas peças e comportamento do player.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fuso horário" hint="Base para períodos de campanhas e agendamentos.">
              <Select
                value={TIMEZONES.includes(form.timezone) ? form.timezone : ""}
                onChange={(e) => set({ timezone: e.target.value || form.timezone })}
              >
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("America/", "").replace("_", " ")} ({t})
                  </option>
                ))}
                {!TIMEZONES.includes(form.timezone) && <option value="">{form.timezone}</option>}
              </Select>
            </Field>
            <Field label="Duração padrão">
              <NumberInput
                value={form.defaultDurationSec}
                min={2}
                max={600}
                suffix="s"
                onChange={(v) => v && set({ defaultDurationSec: v })}
              />
            </Field>
            <Field label="Transição padrão">
              <Select value={form.defaultTransition} onChange={(e) => set({ defaultTransition: e.target.value as Transition })}>
                {TRANSITIONS.map((t) => (
                  <option key={t} value={t}>
                    {TRANSITION_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração das transições" hint="Entre 300 e 4000 ms. Recomendado: 1200–1600.">
              <NumberInput
                value={form.transitionMs}
                min={300}
                max={4000}
                step={100}
                suffix="ms"
                onChange={(v) => v && set({ transitionMs: Math.round(v) })}
              />
            </Field>
            <Field label="Verificar atualizações a cada" hint="Intervalo em que as TVs consultam a versão publicada.">
              <NumberInput
                value={form.player.pollSeconds}
                min={15}
                max={3600}
                suffix="s"
                onChange={(v) => v && set({ player: { ...form.player, pollSeconds: Math.round(v) } })}
              />
            </Field>
            <Field
              label="Recarregar a página a cada"
              hint="Manutenção preventiva de memória (0 = nunca). Só ocorre com conexão disponível."
            >
              <NumberInput
                value={form.player.reloadHours}
                min={0}
                max={72}
                suffix="h"
                onChange={(v) => set({ player: { ...form.player, reloadHours: v ?? 0 } })}
              />
            </Field>
          </div>
          <Field
            label="Observação sobre resultados"
            className="mt-4"
            hint="Exibida nas peças de antes e depois e nas artes com a opção ativada."
          >
            <Input value={form.resultsDisclaimer} maxLength={240} onChange={(e) => set({ resultsDisclaimer: e.target.value })} />
          </Field>
        </Card>

        <Card
          title="Contato geral"
          description="Usado quando a unidade não tiver contato próprio. Deixe vazio se não houver um número oficial."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp" hint="DDI + DDD + número, somente dígitos">
              <Input
                inputMode="tel"
                value={form.contact.whatsapp ?? ""}
                maxLength={20}
                onChange={(e) => set({ contact: { ...form.contact, whatsapp: e.target.value.replace(/\D/g, "") } })}
              />
            </Field>
            <Field label="Mensagem inicial do WhatsApp">
              <Input
                value={form.contact.whatsappMessage ?? ""}
                maxLength={300}
                onChange={(e) => set({ contact: { ...form.contact, whatsappMessage: e.target.value } })}
              />
            </Field>
            <Field label="Instagram">
              <Input
                value={form.contact.instagram ?? ""}
                maxLength={60}
                placeholder="@primeesthetics"
                onChange={(e) => set({ contact: { ...form.contact, instagram: e.target.value } })}
              />
            </Field>
            <Field label="Site">
              <Input
                value={form.contact.website ?? ""}
                maxLength={200}
                onChange={(e) => set({ contact: { ...form.contact, website: e.target.value } })}
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Tela de contingência"
          description="Exibida quando não há peças disponíveis, sem conexão na primeira carga ou em caso de falhas."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <Input
                  value={form.fallback.title}
                  maxLength={120}
                  onChange={(e) => set({ fallback: { ...form.fallback, title: e.target.value } })}
                />
              </Field>
              <Field label="Mensagem">
                <Input
                  value={form.fallback.message}
                  maxLength={200}
                  onChange={(e) => set({ fallback: { ...form.fallback, message: e.target.value } })}
                />
              </Field>
            </div>
            <MediaPicker
              label="Imagem de fundo"
              optional
              value={form.fallback.mediaId}
              onChange={(id) => set({ fallback: { ...form.fallback, mediaId: id } })}
              uploadCategory="institucional"
            />
          </div>
        </Card>

        <Card title="Programações" description="Sequências que podem ser atribuídas às unidades.">
          <ul className="divide-y divide-sand-200">
            {draft.playlists.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <ListVideo className="size-4 text-sand-400" />
                <Input
                  className="h-9 flex-1"
                  value={p.name}
                  maxLength={120}
                  onChange={(e) =>
                    update((d) => {
                      d.playlists.find((x) => x.id === p.id)!.name = e.target.value;
                    })
                  }
                />
                <span className="w-28 text-right text-xs text-sand-500">
                  {p.items.length} itens · {usedPlaylists.has(p.id) ? "em uso" : "sem uso"}
                </span>
                <IconButton
                  icon={Trash2}
                  label={usedPlaylists.has(p.id) ? "Em uso por uma unidade" : "Excluir programação"}
                  tone="danger"
                  disabled={usedPlaylists.has(p.id)}
                  onClick={async () => {
                    if (!(await confirm({ title: `Excluir "${p.name}"?`, danger: true, confirmLabel: "Excluir" }))) return;
                    update((d) => {
                      d.playlists = d.playlists.filter((x) => x.id !== p.id);
                    });
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Sistema"
          actions={
            <Button size="sm" icon={RefreshCw} loading={checking} onClick={() => void check()}>
              Verificar configuração
            </Button>
          }
        >
          <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-y-2 text-[13px]">
            <dt className="text-sand-500">Armazenamento</dt>
            <dd className="flex items-center gap-1.5">
              <Server className="size-3.5 text-sand-400" />
              {storage.kind === "github" ? `GitHub · ${storage.repo} (${storage.branch})` : "Local (desenvolvimento)"}
            </dd>
            <dt className="text-sand-500">Versão no ar</dt>
            <dd className="font-mono">{deployed.version}</dd>
            <dt className="text-sand-500">Build</dt>
            <dd>
              {new Date(deployed.builtAt).toLocaleString("pt-BR")}
              {deployed.commit ? ` · ${deployed.commit.slice(0, 7)}` : ""}
            </dd>
            <dt className="text-sand-500">Revisão do rascunho</dt>
            <dd>{draft.meta.revision}</dd>
          </dl>
          {health && (
            <ul className="mt-4 space-y-1.5 border-t border-sand-200 pt-4 text-[13px]">
              {health.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 text-red-600" />}
                  <span>
                    <strong className="font-medium">{c.label}</strong>
                    {c.detail ? <span className="text-sand-500"> — {c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
