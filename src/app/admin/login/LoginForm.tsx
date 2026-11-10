"use client";

import { KeyRound, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, jsonInit } from "@/lib/client/api";
import { Button, Field, Input, Notice } from "@/components/admin/ui";

export function LoginForm({ next, expired, missing }: { next: string; expired: boolean; missing: string[] }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (missing.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-sand-900">Configuração pendente</h1>
        <Notice tone="amber" icon={KeyRound} title="O login está desativado até que as credenciais sejam configuradas.">
          Defina no servidor: {missing.join(", ")}.
        </Notice>
        <p className="text-sm leading-relaxed text-sand-600">
          Gere o hash da senha e a chave de sessão em{" "}
          <Link href="/admin/setup" className="font-medium text-brand-600 underline">
            /admin/setup
          </Link>{" "}
          (tudo é calculado no seu navegador) e cadastre-os nas variáveis de ambiente do Vercel.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/login", jsonInit("POST", { username, password }));
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-sand-900">Entrar no painel</h1>
        <p className="text-sm text-sand-500">Gerencie a programação das TVs das unidades.</p>
      </div>
      {expired && !error && <Notice tone="blue">Sua sessão expirou. Entre novamente.</Notice>}
      {error && <Notice tone="red">{error}</Notice>}
      <Field label="Usuário" htmlFor="u">
        <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      </Field>
      <Field label="Senha" htmlFor="p">
        <Input
          id="p"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" icon={Lock} loading={loading}>
        Entrar
      </Button>
    </form>
  );
}
