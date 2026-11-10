import { isSecureRequest } from "@/lib/server/auth";
import { json, withErrors } from "@/lib/server/http";
import { clearSessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const POST = withErrors(async (request: Request) => {
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(isSecureRequest(request)) } });
});
