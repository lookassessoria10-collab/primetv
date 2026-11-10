export const dynamic = "force-dynamic";

/** Verificação leve de conectividade usada pelo player antes de recarregar a página. */
export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });
}
