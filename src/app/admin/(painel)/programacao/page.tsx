"use client";

import { Suspense } from "react";
import { ProgramacaoEditor } from "./ProgramacaoEditor";

export default function ProgramacaoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-sand-500">Carregando…</p>}>
      <ProgramacaoEditor />
    </Suspense>
  );
}
