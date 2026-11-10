"use client";

import { ImageIcon, Replace, ShieldAlert, Video, X } from "lucide-react";
import { useMemo, useState } from "react";
import { mediaBlockReason, MEDIA_BLOCK_LABEL } from "@/lib/manifest";
import type { Media, MediaCategory } from "@/lib/schema";
import { MEDIA_CATEGORY_LABEL } from "@/lib/slide-meta";
import { useDraft } from "./DraftProvider";
import { UploadPanel } from "./UploadPanel";
import { Badge, Button, cx, Input, Modal, Segmented } from "./ui";

export function MediaThumb({ media, className, fit = "cover" }: { media: Media; className?: string; fit?: "cover" | "contain" }) {
  const { mediaUrl } = useDraft();
  return media.kind === "video" ? (
    <video
      src={mediaUrl(media)}
      muted
      preload="metadata"
      className={cx("size-full bg-sand-900", fit === "cover" ? "object-cover" : "object-contain", className)}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(media)}
      alt=""
      loading="lazy"
      className={cx("size-full", fit === "cover" ? "object-cover" : "object-contain", className)}
      style={{ objectPosition: `${media.focalX}% ${media.focalY}%` }}
    />
  );
}

/** Campo de seleção de mídia com biblioteca e envio rápido. */
export function MediaPicker({
  value,
  onChange,
  kind = "image",
  label,
  optional,
  uploadCategory = "arte",
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  kind?: "image" | "video";
  label: string;
  optional?: boolean;
  uploadCategory?: MediaCategory;
}) {
  const { mediaById } = useDraft();
  const [open, setOpen] = useState(false);
  const media = value ? mediaById.get(value) : undefined;
  const blocked = media ? mediaBlockReason(media) : null;
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-sand-800">
        {label} {optional && <span className="font-normal text-sand-500">(opcional)</span>}
      </p>
      <div className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white p-2">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand-100">
          {media ? (
            <MediaThumb media={media} />
          ) : kind === "video" ? (
            <Video className="size-5 text-sand-400" />
          ) : (
            <ImageIcon className="size-5 text-sand-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sand-900">
            {media ? media.name : value ? "Mídia removida" : "Nenhuma selecionada"}
          </p>
          {media && (
            <p className="text-xs text-sand-500">
              {media.width}×{media.height} · {MEDIA_CATEGORY_LABEL[media.category]}
            </p>
          )}
          {blocked && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
              <ShieldAlert className="size-3" /> {MEDIA_BLOCK_LABEL[blocked]} — não aparece na TV
            </p>
          )}
        </div>
        <Button size="sm" icon={Replace} onClick={() => setOpen(true)}>
          {media ? "Trocar" : "Escolher"}
        </Button>
        {optional && media && <Button size="sm" variant="ghost" icon={X} onClick={() => onChange(undefined)} aria-label="Remover" />}
      </div>
      <MediaLibraryDialog
        open={open}
        onClose={() => setOpen(false)}
        kind={kind}
        uploadCategory={uploadCategory}
        onPick={(m) => {
          onChange(m.id);
          setOpen(false);
        }}
      />
    </div>
  );
}

export function MediaLibraryDialog({
  open,
  onClose,
  onPick,
  kind,
  uploadCategory,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: Media) => void;
  kind: "image" | "video";
  uploadCategory: MediaCategory;
}) {
  const { draft } = useDraft();
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MediaCategory | "">("");
  const list = useMemo(
    () =>
      draft.media.filter(
        (m) =>
          m.kind === kind &&
          m.status === "active" &&
          (!cat || m.category === cat) &&
          (m.name.toLowerCase().includes(q.toLowerCase()) || (m.procedure ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [draft.media, kind, q, cat],
  );
  return (
    <Modal open={open} onClose={onClose} title={kind === "video" ? "Escolher vídeo" : "Escolher imagem"} size="xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "library", label: "Biblioteca" },
            { value: "upload", label: "Enviar novo arquivo" },
          ]}
        />
        {tab === "library" && (
          <>
            <Input placeholder="Buscar por nome ou procedimento…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <select
              className="h-10 rounded-lg border border-sand-300 bg-white px-3 text-sm"
              value={cat}
              onChange={(e) => setCat(e.target.value as MediaCategory | "")}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(MEDIA_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {open && tab === "upload" && (
        <UploadPanel
          compact
          defaultCategory={uploadCategory}
          accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
          onUploaded={(created) => {
            setTab("library");
            if (created.length === 1) onPick(created[0]);
          }}
        />
      )}
      {open && tab === "library" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {list.map((m) => {
            const blocked = mediaBlockReason(m);
            return (
              <button key={m.id} type="button" onClick={() => onPick(m)} className="group text-left">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-sand-100 ring-2 ring-transparent transition group-hover:ring-brand-400">
                  <MediaThumb media={m} fit={m.hasText ? "contain" : "cover"} />
                  {blocked && (
                    <span className="absolute inset-x-1 bottom-1">
                      <Badge tone="amber">{MEDIA_BLOCK_LABEL[blocked]}</Badge>
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] font-medium text-sand-800">{m.name}</p>
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="col-span-full text-sm text-sand-500">Nenhum arquivo encontrado. Use “Enviar novo arquivo”.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
