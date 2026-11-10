import "server-only";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(NO_STORE)) if (!headers.has(k)) headers.set(k, v);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Converte erros em respostas JSON com mensagens reais, sem expor segredos. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code, details: error.details }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Erro inesperado";
  console.error("[prime-tv]", message);
  return json({ error: message, code: "internal" }, { status: 500 });
}

export function withErrors<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
