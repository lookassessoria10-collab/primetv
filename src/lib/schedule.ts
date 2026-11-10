import type { Campaign, Schedule } from "./schema";

/**
 * Agenda baseada no fuso horário configurado (padrão America/Bahia).
 * Datas são comparadas como texto "AAAA-MM-DDTHH:mm" no horário local da clínica,
 * o que mantém o comportamento correto independentemente do fuso da TV ou do servidor.
 */

export interface LocalParts {
  /** "AAAA-MM-DDTHH:mm" */
  stamp: string;
  /** "HH:mm" */
  time: string;
  /** "AAAA-MM-DD" */
  date: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatterCache: Record<string, Intl.DateTimeFormat | null> = {};

function getFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (timeZone in formatterCache) return formatterCache[timeZone];
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
  } catch {
    fmt = null;
  }
  formatterCache[timeZone] = fmt;
  return fmt;
}

const pad = (n: number) => (n < 10 ? "0" + n : String(n));

export function localParts(date: Date, timeZone: string): LocalParts {
  const fmt = getFormatter(timeZone) ?? getFormatter("America/Bahia");
  if (fmt) {
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
    // Alguns navegadores retornam "24" para meia-noite com hour12:false.
    const hour = parts.hour === "24" ? "00" : parts.hour;
    const d = `${parts.year}-${parts.month}-${parts.day}`;
    const t = `${hour}:${parts.minute}`;
    return { stamp: `${d}T${t}`, time: t, date: d, weekday: WEEKDAYS[parts.weekday] ?? date.getDay() };
  }
  // Último recurso: UTC-3 fixo (Bahia não adota horário de verão).
  const shifted = new Date(date.getTime() - 3 * 3600 * 1000);
  const d = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const t = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
  return { stamp: `${d}T${t}`, time: t, date: d, weekday: shifted.getUTCDay() };
}

export function isValidTimeZone(timeZone: string): boolean {
  return getFormatter(timeZone) !== null;
}

/** Janela diária e dias da semana (sem considerar início/fim). */
function inDailyWindow(s: Schedule, p: LocalParts): boolean {
  if (s.weekdays && s.weekdays.length > 0 && s.weekdays.indexOf(p.weekday) === -1) return false;
  if (s.timeStart || s.timeEnd) {
    const start = s.timeStart || "00:00";
    const end = s.timeEnd || "24:00";
    if (start <= end) {
      if (p.time < start || p.time >= end) return false;
    } else if (p.time < start && p.time >= end) {
      // janela que atravessa a meia-noite, ex.: 18:00–02:00
      return false;
    }
  }
  return true;
}

export function isScheduleActive(s: Schedule | undefined, p: LocalParts): boolean {
  if (!s) return true;
  if (s.startAt && p.stamp < s.startAt) return false;
  if (s.endAt && p.stamp >= s.endAt) return false;
  return inDailyWindow(s, p);
}

export function hasSchedule(s: Schedule | undefined): boolean {
  if (!s) return false;
  return Boolean(s.startAt || s.endAt || s.timeStart || s.timeEnd || (s.weekdays && s.weekdays.length));
}

export type CampaignPhase = "draft" | "paused" | "archived" | "scheduled" | "live" | "waiting" | "ended";

export const CAMPAIGN_PHASE_LABEL: Record<CampaignPhase, string> = {
  draft: "Rascunho",
  paused: "Pausada",
  archived: "Arquivada",
  scheduled: "Programada",
  live: "Em exibição",
  waiting: "Fora do horário",
  ended: "Encerrada",
};

export function campaignPhase(c: Pick<Campaign, "status" | "schedule">, p: LocalParts): CampaignPhase {
  if (c.status !== "active") return c.status;
  const s = c.schedule || {};
  if (s.startAt && p.stamp < s.startAt) return "scheduled";
  if (s.endAt && p.stamp >= s.endAt) return "ended";
  if (!inDailyWindow(s, p)) return "waiting";
  return "live";
}

export function campaignAppliesToUnit(c: Pick<Campaign, "scope" | "unitIds">, unitId: string): boolean {
  return c.scope === "global" || c.unitIds.indexOf(unitId) !== -1;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatLocalStamp(stamp: string | undefined): string {
  if (!stamp) return "";
  const [d, t] = stamp.split("T");
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y} ${t}`;
}

export function describeSchedule(s: Schedule | undefined): string {
  if (!hasSchedule(s) || !s) return "Sem restrição de período";
  const out: string[] = [];
  if (s.startAt && s.endAt) out.push(`${formatLocalStamp(s.startAt)} → ${formatLocalStamp(s.endAt)}`);
  else if (s.startAt) out.push(`A partir de ${formatLocalStamp(s.startAt)}`);
  else if (s.endAt) out.push(`Até ${formatLocalStamp(s.endAt)}`);
  if (s.weekdays && s.weekdays.length && s.weekdays.length < 7) out.push(s.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", "));
  if (s.timeStart || s.timeEnd) out.push(`${s.timeStart || "00:00"}–${s.timeEnd || "24:00"}`);
  return out.join(" · ");
}

export { WEEKDAY_SHORT };

/** Converte "AAAA-MM-DDTHH:mm" no fuso da clínica para um instante (Date). */
export function zonedStampToDate(stamp: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stamp)) return null;
  const guess = Date.parse(`${stamp}:00Z`);
  if (Number.isNaN(guess)) return null;
  const shown = Date.parse(`${localParts(new Date(guess), timeZone).stamp}:00Z`);
  return new Date(guess - (shown - guess));
}
