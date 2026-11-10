"use client";

import type { Schedule } from "@/lib/schema";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { Field, Input, cx } from "./ui";

/** Campos de período: início/fim, dias da semana e faixa de horário (fuso da clínica). */
export function ScheduleFields({
  value,
  onChange,
  timezone,
}: {
  value: Schedule | undefined;
  onChange: (s: Schedule) => void;
  timezone: string;
}) {
  const s = value ?? {};
  const set = (patch: Partial<Schedule>) => {
    const next: Schedule = { ...s, ...patch };
    for (const k of Object.keys(next) as (keyof Schedule)[]) {
      const v = next[k];
      if (v === "" || v === undefined || (Array.isArray(v) && v.length === 0)) delete next[k];
    }
    onChange(next);
  };
  const days = s.weekdays ?? [];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início" hint={`Vazio = imediatamente. Fuso: ${timezone}`}>
          <Input type="datetime-local" value={s.startAt ?? ""} onChange={(e) => set({ startAt: e.target.value || undefined })} />
        </Field>
        <Field label="Término" hint="Vazio = sem data de término">
          <Input type="datetime-local" value={s.endAt ?? ""} onChange={(e) => set({ endAt: e.target.value || undefined })} />
        </Field>
      </div>
      <Field label="Dias da semana" hint="Nenhum selecionado = todos os dias">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((label, d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set({ weekdays: on ? days.filter((x) => x !== d) : [...days, d].sort() })}
                className={cx(
                  "h-8 w-12 rounded-lg text-[13px] font-medium ring-1 transition",
                  on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-sand-700 ring-sand-300 hover:bg-sand-100",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exibir a partir de" hint="Horário diário opcional">
          <Input type="time" value={s.timeStart ?? ""} onChange={(e) => set({ timeStart: e.target.value || undefined })} />
        </Field>
        <Field label="Exibir até">
          <Input type="time" value={s.timeEnd ?? ""} onChange={(e) => set({ timeEnd: e.target.value || undefined })} />
        </Field>
      </div>
    </div>
  );
}
