import { buildCycle, newRotation } from "./cycle";
import { buildUnitManifest, slideAvailability } from "./manifest";
import { campaignAppliesToUnit, isValidTimeZone, localParts } from "./schedule";
import type { Store } from "./schema";

export type IssueLevel = "error" | "warning";
export type IssueArea = "unidades" | "programacao" | "pecas" | "campanhas" | "midias" | "configuracoes";

export interface Issue {
  level: IssueLevel;
  area: IssueArea;
  message: string;
  href?: string;
}

const MEDIA_PATH = /^media\/[a-z0-9][a-z0-9/_.-]*\.(webp|jpe?g|png|avif|mp4|webm)$/i;

/**
 * Validação de integridade para publicação.
 * Erros bloqueiam a publicação; avisos são exibidos para o administrador decidir.
 */
export function validateStore(store: Store, now: Date = new Date()): Issue[] {
  const issues: Issue[] = [];
  const err = (area: IssueArea, message: string, href?: string) => issues.push({ level: "error", area, message, href });
  const warn = (area: IssueArea, message: string, href?: string) => issues.push({ level: "warning", area, message, href });

  const dupCheck = (area: IssueArea, label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(area, `${label} com identificador duplicado: ${id}`);
      seen.add(id);
    }
  };
  dupCheck(
    "unidades",
    "Unidade",
    store.units.map((u) => u.id),
  );
  dupCheck(
    "programacao",
    "Programação",
    store.playlists.map((p) => p.id),
  );
  dupCheck(
    "pecas",
    "Peça",
    store.slides.map((s) => s.id),
  );
  dupCheck(
    "campanhas",
    "Campanha",
    store.campaigns.map((c) => c.id),
  );
  dupCheck(
    "midias",
    "Mídia",
    store.media.map((m) => m.id),
  );

  const codes = new Map<string, string>();
  for (const u of store.units) {
    const other = codes.get(u.code);
    if (other) err("unidades", `As unidades "${other}" e "${u.name}" usam o mesmo código "${u.code}".`, "/admin/unidades");
    codes.set(u.code, u.name);
  }

  if (!isValidTimeZone(store.settings.timezone)) {
    err("configuracoes", `Fuso horário inválido: ${store.settings.timezone}`, "/admin/configuracoes");
  }

  const playlistIds = new Set(store.playlists.map((p) => p.id));
  const slideById = new Map(store.slides.map((s) => [s.id, s]));
  const campaignIds = new Set(store.campaigns.map((c) => c.id));
  const unitIds = new Set(store.units.map((u) => u.id));
  const mediaById = new Map(store.media.map((m) => [m.id, m]));

  for (const m of store.media) {
    if (m.storage === "repo" && !MEDIA_PATH.test(m.path)) err("midias", `Caminho de mídia inválido: ${m.path}`, "/admin/midias");
  }

  for (const u of store.units) {
    if (!playlistIds.has(u.playlistId))
      err("unidades", `A unidade "${u.name}" aponta para uma programação inexistente.`, "/admin/unidades");
    if (u.fallbackPlaylistId && !playlistIds.has(u.fallbackPlaylistId)) {
      err("unidades", `A programação institucional da unidade "${u.name}" não existe.`, "/admin/unidades");
    }
  }

  for (const p of store.playlists) {
    for (const item of p.items) {
      if (item.kind === "slide") {
        const s = slideById.get(item.slideId);
        if (!s) {
          err("programacao", `A programação "${p.name}" contém uma peça que não existe mais.`, "/admin/programacao");
          continue;
        }
        if (item.campaignId && !campaignIds.has(item.campaignId)) {
          err("programacao", `A peça "${s.name}" em "${p.name}" está vinculada a uma campanha inexistente.`, "/admin/programacao");
        }
        if (item.schedule?.startAt && item.schedule?.endAt && item.schedule.startAt >= item.schedule.endAt) {
          err("programacao", `A peça "${s.name}" em "${p.name}" tem início posterior ao fim.`, "/admin/programacao");
        }
        if (!item.hidden) {
          const av = slideAvailability(s, mediaById);
          if (!av.ok) warn("programacao", `"${s.name}" (${p.name}) não será exibida: ${av.reasons.join("; ")}.`, `/admin/pecas/${s.id}`);
        }
      } else {
        if (item.fallbackSlideId && !slideById.has(item.fallbackSlideId)) {
          err("programacao", `Um espaço de campanha em "${p.name}" usa uma peça substituta inexistente.`, "/admin/programacao");
        }
        for (const cid of item.campaignIds) {
          if (!campaignIds.has(cid))
            err("programacao", `Um espaço de campanha em "${p.name}" usa uma campanha inexistente.`, "/admin/programacao");
        }
      }
    }
  }

  const parts = localParts(now, store.settings.timezone);
  for (const c of store.campaigns) {
    for (const it of c.items) {
      if (!slideById.has(it.slideId)) err("campanhas", `A campanha "${c.name}" contém uma peça que não existe mais.`, "/admin/campanhas");
    }
    for (const uid of c.unitIds) {
      if (!unitIds.has(uid)) err("campanhas", `A campanha "${c.name}" está associada a uma unidade inexistente.`, "/admin/campanhas");
    }
    const s = c.schedule;
    if (s.startAt && s.endAt && s.startAt >= s.endAt)
      err("campanhas", `A campanha "${c.name}" termina antes de começar.`, "/admin/campanhas");
    if (c.status !== "active") continue;
    if (c.scope === "units" && c.unitIds.length === 0)
      warn("campanhas", `A campanha "${c.name}" está ativa, mas nenhuma unidade foi selecionada.`, "/admin/campanhas");
    if (!s.endAt) warn("campanhas", `A campanha "${c.name}" está ativa sem data de término.`, "/admin/campanhas");
    if (s.endAt && parts.stamp >= s.endAt)
      warn("campanhas", `A campanha "${c.name}" já terminou e pode ser arquivada.`, "/admin/campanhas");
    const usableItems = c.items.filter((it) => slideAvailability(slideById.get(it.slideId), mediaById).ok);
    if (usableItems.length === 0) warn("campanhas", `A campanha "${c.name}" está ativa, mas não tem peças exibíveis.`, "/admin/campanhas");
  }

  if (!store.units.some((u) => u.active)) warn("unidades", "Nenhuma unidade ativa.", "/admin/unidades");

  for (const u of store.units) {
    if (!u.active) continue;
    const playlist = store.playlists.find((p) => p.id === u.playlistId);
    const hasSlots = playlist?.items.some((i) => i.kind === "campaign" && !i.hidden) ?? false;
    if (!hasSlots && u.autoCampaignEvery === 0) {
      const affected = store.campaigns.filter((c) => c.status === "active" && campaignAppliesToUnit(c, u.id));
      for (const c of affected) {
        warn(
          "programacao",
          `A campanha "${c.name}" não aparecerá em "${u.name}": a programação não tem espaço de campanha.`,
          `/admin/programacao?unidade=${u.code}`,
        );
      }
    }
    try {
      const manifest = buildUnitManifest(store, u);
      const cycle = buildCycle(manifest, now, newRotation());
      if (cycle.length === 0) {
        warn(
          "programacao",
          `A unidade "${u.name}" não tem peças exibíveis agora; a TV mostrará a tela de contingência.`,
          `/admin/programacao?unidade=${u.code}`,
        );
      }
      const usesWhatsapp = Object.values(manifest.slides).some(
        (s) =>
          s.type === "cta" &&
          ((s.data as { showWhatsapp?: boolean }).showWhatsapp || (s.data as { qrTarget?: string }).qrTarget === "whatsapp"),
      );
      if (usesWhatsapp && !manifest.unit.whatsapp) {
        warn(
          "unidades",
          `"${u.name}" exibe chamadas para WhatsApp, mas nenhum número foi configurado. O número e o QR Code ficarão ocultos.`,
          "/admin/unidades",
        );
      }
    } catch {
      // erros estruturais já reportados acima
    }
  }

  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === "error");
}
