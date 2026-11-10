"use client";

import { FileWarning, ImageUp, Loader2, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Media, MediaCategory } from "@/lib/schema";
import { MEDIA_CATEGORIES } from "@/lib/schema";
import { formatBytes, prepareUpload, type PrepMode, type PreparedUpload } from "@/lib/client/upload";
import { MEDIA_CATEGORY_LABEL } from "@/lib/slide-meta";
import { useDraft } from "./DraftProvider";
import { Button, cx, Field, IconButton, Input, Notice, Segmented, Select, Switch, useFeedback } from "./ui";

interface Row {
  file: File;
  status: "preparing" | "ready" | "error";
  prepared?: PreparedUpload;
  error?: string;
}

/**
 * Envio de mídias: arrastar e soltar, múltiplos arquivos, otimização no navegador
 * e gravação no repositório em lotes que respeitam o limite do Vercel.
 */
export function UploadPanel({
  defaultCategory = "arte",
  accept = "image/*,video/mp4,video/webm",
  onUploaded,
  compact,
}: {
  defaultCategory?: MediaCategory;
  accept?: string;
  onUploaded?: (media: Media[]) => void;
  compact?: boolean;
}) {
  const { uploadMedia } = useDraft();
  const { toast } = useFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<PrepMode>(
    defaultCategory === "resultado" || defaultCategory === "arte" || defaultCategory === "campanha" ? "art" : "photo",
  );
  const [category, setCategory] = useState<MediaCategory>(defaultCategory);
  const [procedure, setProcedure] = useState("");
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [clinical, setClinical] = useState(defaultCategory === "resultado");
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Libera as pré-visualizações locais ao fechar o painel.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    for (const r of rows) if (r.prepared && !urls.current.includes(r.prepared.previewUrl)) urls.current.push(r.prepared.previewUrl);
  }, [rows]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Reprocessa quando o tipo de tratamento muda.
  const prepareAll = async (files: File[], m: PrepMode, keep: boolean) => {
    setRows(files.map((file) => ({ file, status: "preparing" })));
    for (let i = 0; i < files.length; i++) {
      try {
        const prepared = await prepareUpload(files[i], m, keep);
        setRows((r) => r.map((row, idx) => (idx === i ? { ...row, status: "ready", prepared } : row)));
      } catch (e) {
        setRows((r) =>
          r.map((row, idx) => (idx === i ? { ...row, status: "error", error: e instanceof Error ? e.message : String(e) } : row)),
        );
      }
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...rows.map((r) => r.file), ...Array.from(list)];
    void prepareAll(files, mode, keepOriginal);
  };

  const ready = rows.filter((r) => r.status === "ready" && r.prepared).map((r) => r.prepared!);
  const preparing = rows.some((r) => r.status === "preparing");

  const send = async () => {
    try {
      const created = await uploadMedia(
        ready,
        { category, procedure: procedure.trim() || undefined, hasText: mode !== "photo", clinical },
        (done, total) => setProgress({ done, total }),
      );
      toast(`${created.length} arquivo(s) enviado(s) e catalogado(s). O rascunho foi salvo.`);
      setRows([]);
      onUploaded?.(created);
    } catch (e) {
      toast(`Falha no envio: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
          compact ? "px-4 py-6" : "px-6 py-10",
          over ? "border-brand-400 bg-brand-50" : "border-sand-300 bg-sand-50/60 hover:border-brand-300 hover:bg-brand-50/40",
        )}
      >
        <UploadCloud className="size-7 text-brand-500" aria-hidden />
        <p className="mt-2 text-sm font-medium text-sand-800">Arraste imagens ou vídeos para cá</p>
        <p className="text-xs text-sand-500">ou clique para selecionar · vários arquivos · JPEG, PNG, WebP, MP4, WebM</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Tratamento da imagem"
          hint={
            mode === "photo"
              ? "Redimensiona para a TV e converte em WebP abaixo de 1 MB."
              : mode === "art"
                ? "Para artes com textos: preserva o arquivo ou usa WebP de alta qualidade, sem compressão agressiva."
                : "Envia o arquivo sem nenhuma alteração (até 4 MB)."
          }
        >
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (rows.length)
                void prepareAll(
                  rows.map((r) => r.file),
                  m,
                  keepOriginal,
                );
            }}
            options={[
              { value: "photo", label: "Fotografia" },
              { value: "art", label: "Arte com texto" },
              { value: "original", label: "Original" },
            ]}
          />
        </Field>
        <Field label="Categoria">
          <Select
            value={category}
            onChange={(e) => {
              const c = e.target.value as MediaCategory;
              setCategory(c);
              if (c === "resultado") setClinical(true);
            }}
          >
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEDIA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Procedimento associado" hint="Opcional. Ajuda a encontrar a mídia depois.">
          <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Ex.: Preenchimento labial" />
        </Field>
        <div className="space-y-3 pt-1">
          <Switch
            checked={clinical}
            onChange={setClinical}
            label="Fotografia de paciente / resultado clínico"
            description="Só vai para a TV depois de registrar a autorização de uso."
          />
          <Switch
            checked={keepOriginal}
            onChange={(v) => {
              setKeepOriginal(v);
              if (rows.length)
                void prepareAll(
                  rows.map((r) => r.file),
                  mode,
                  v,
                );
            }}
            label="Guardar original para documentação"
            description="Arquivado fora da área pública (archive/originals)."
          />
        </div>
      </div>

      {clinical && (
        <Notice tone="amber" icon={ShieldAlert}>
          Arquivos marcados como resultado clínico ficam com autorização <strong>pendente</strong> e não aparecem na TV até que a
          autorização seja registrada na mídia.
        </Notice>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
          {rows.map((r, i) => (
            <li key={`${r.file.name}-${i}`} className="flex items-center gap-3 p-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                {r.prepared?.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.prepared.previewUrl} alt="" className="size-full object-cover" />
                )}
                {r.prepared?.kind === "video" && <video src={r.prepared.previewUrl} muted className="size-full object-cover" />}
                {r.status === "preparing" && <Loader2 className="m-4 size-6 animate-spin text-sand-400" />}
                {r.status === "error" && <FileWarning className="m-4 size-6 text-red-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sand-900">{r.file.name}</p>
                <p className={cx("text-xs leading-relaxed", r.status === "error" ? "text-red-700" : "text-sand-500")}>
                  {r.status === "preparing" ? "Otimizando…" : r.status === "error" ? r.error : r.prepared?.note}
                </p>
              </div>
              <IconButton
                icon={Trash2}
                label="Remover da lista"
                tone="danger"
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              />
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {progress && (
            <span className="text-sm text-sand-600">
              Enviando {progress.done}/{progress.total}…
            </span>
          )}
          <span className="text-xs text-sand-500">
            {formatBytes(ready.reduce((s, r) => s + r.display.size + (r.original?.size ?? 0), 0))} no total
          </span>
          <Button variant="primary" icon={ImageUp} disabled={!ready.length || preparing || !!progress} loading={!!progress} onClick={send}>
            Enviar {ready.length} arquivo(s)
          </Button>
        </div>
      )}
    </div>
  );
}
