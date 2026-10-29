import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { runConnectivityDiagnostic } from "@/src/server/location/connectivity-diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const expiresAt = Date.parse("2026-11-05T00:00:00Z");
let lastRun = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Não autorizado." }, { status: 401, headers });
  } catch {
    return Response.json({ error: "Não foi possível verificar a sessão." }, { status: 503, headers });
  }
  if (Date.now() >= expiresAt) {
    return Response.json({ error: "Diagnóstico temporário encerrado." }, { status: 410, headers });
  }
  if (Date.now() - lastRun < 60000) {
    return Response.json({ error: "Aguarde um minuto entre diagnósticos." }, {
      status: 429, headers: { ...headers, "Retry-After": "60" },
    });
  }
  lastRun = Date.now();
  const result = await runConnectivityDiagnostic();
  for (const sample of result.samples) {
    console.info("[location:ibge:http-diagnostic]", JSON.stringify(sample));
  }
  return Response.json(result, { headers });
}
