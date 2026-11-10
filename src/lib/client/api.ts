export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Chamada às rotas internas com mensagens de erro reais do servidor. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Verifique a internet e tente novamente.", 0, "network");
  }
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const b = (body && typeof body === "object" ? body : {}) as { error?: string; code?: string; details?: unknown };
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/admin/login?next=${next}&expirada=1`;
    }
    const fallback = res.status === 413 ? "Envio maior que o limite permitido." : `Erro ${res.status}`;
    throw new ApiError(b.error || fallback, res.status, b.code, b.details);
  }
  return body as T;
}

export function jsonInit(method: string, data: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}
