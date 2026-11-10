"use client";

import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { hashPassword, passwordProblems, randomSecret } from "@/lib/password";
import { Button, Field, Input, Notice } from "@/components/admin/ui";

/** Gerador de credenciais: o hash é calculado no navegador; nada é enviado ao servidor. */
export default function SetupPage() {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ hash: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const problems = password ? passwordProblems(password) : [];
  const mismatch = confirm && confirm !== password;

  const generate = async () => {
    setBusy(true);
    const hash = await hashPassword(password);
    setResult({ hash, secret: randomSecret(32) });
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-sand-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-brown.png" alt="Prime Esthetics" className="h-auto w-44" />
          <span className="text-[11px] font-medium tracking-[0.24em] text-sand-500 uppercase">Configuração de acesso</span>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-7 shadow-sm">
          <h1 className="font-display text-2xl text-sand-900">Credenciais do administrador</h1>
          <p className="mt-2 text-sm leading-relaxed text-sand-600">
            Escolha a senha do painel. O hash é calculado neste navegador com PBKDF2-SHA256; a senha nunca é enviada. Copie os valores
            gerados para as variáveis de ambiente do projeto no Vercel e faça um novo deploy.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Usuário (ADMIN_USER)">
              <Input value={user} onChange={(e) => setUser(e.target.value.trim())} />
            </Field>
            <div />
            <Field label="Senha" error={problems.length ? `Senha fraca: ${problems.join(", ")}.` : null}>
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirmar senha" error={mismatch ? "As senhas não conferem." : null}>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          <Button
            className="mt-5"
            variant="primary"
            icon={KeyRound}
            loading={busy}
            disabled={!user || !password || problems.length > 0 || confirm !== password}
            onClick={generate}
          >
            Gerar credenciais
          </Button>

          {result && (
            <div className="mt-7 space-y-3">
              <Notice tone="green" icon={ShieldCheck} title="Copie estes valores para o Vercel (Settings → Environment Variables).">
                Depois de salvar as variáveis, faça um novo deploy para que passem a valer. Guarde a senha em local seguro: ela não pode ser
                recuperada a partir do hash.
              </Notice>
              <EnvLine name="ADMIN_USER" value={user} />
              <EnvLine name="ADMIN_PASSWORD_HASH" value={result.hash} />
              <EnvLine name="SESSION_SECRET" value={result.secret} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EnvLine({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-sand-200 bg-sand-50 p-2 pl-3">
      <code className="min-w-0 flex-1 truncate text-[12.5px] text-sand-800">
        <span className="font-semibold">{name}</span>={value}
      </code>
      <Button
        size="sm"
        icon={copied ? Check : Copy}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
