import { runConnectivityDiagnostic } from "@/src/server/location/connectivity-diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const expiresAt = Date.parse("2026-11-05T00:00:00Z");
let lastRun = 0;

export async function GET() {
  // Deployment Protection is enabled for Preview URLs. This guard ensures the
  // temporary diagnostic cannot run in production or outside a Vercel Preview.
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404, headers });
  }
  if (Date.now() >= expiresAt) {
    return Response.json(
      { error: "Diagnóstico temporário encerrado." },
      { status: 410, headers },
    );
  }
  if (Date.now() - lastRun < 60000) {
    return Response.json(
      { error: "Aguarde um minuto entre diagnósticos." },
      {
        status: 429,
        headers: { ...headers, "Retry-After": "60" },
      },
    );
  }
  lastRun = Date.now();
  const result = await runConnectivityDiagnostic();
  for (const sample of result.samples) {
    console.info("[location:ibge:http-diagnostic]", JSON.stringify(sample));
  }
  return Response.json(result, { headers });
}
