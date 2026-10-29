// Temporary diagnostic. Fixed public targets only; never accept caller URLs or headers.
export const CONNECTIVITY_TARGETS = {
  ibge: "https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios?orderBy=nome",
  control: "https://api.github.com/",
} as const;

type Sample = {
  target: keyof typeof CONNECTIVITY_TARGETS;
  attempt: number;
  startedAt: string;
  status: number | null;
  durationMs: number;
  errorType: string | null;
};

export async function runConnectivityDiagnostic(transport: typeof fetch = fetch) {
  const timeoutMs = 5000;
  const samples: Sample[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const round = await Promise.all(
      (Object.keys(CONNECTIVITY_TARGETS) as Sample["target"][]).map(async (target) => {
        const started = Date.now();
        const sample: Sample = {
          target, attempt, startedAt: new Date(started).toISOString(),
          status: null, durationMs: 0, errorType: null,
        };
        try {
          const response = await transport(CONNECTIVITY_TARGETS[target], {
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs),
          });
          sample.status = response.status;
          sample.durationMs = Date.now() - started;
          // Measure HTTP headers; discard the body without parsing or logging it.
          await response.body?.cancel().catch(() => {});
        } catch (error: unknown) {
          sample.durationMs = Date.now() - started;
          const cause = error instanceof Error ? error.cause : undefined;
          const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
          sample.errorType = typeof code === "string" && /^[A-Z_0-9]+$/.test(code)
            ? code : error instanceof Error ? error.name : "UnknownError";
        }
        return sample;
      }),
    );
    samples.push(...round);
  }
  return {
    diagnosticVersion: "ibge-connectivity-v1",
    runtime: "nodejs",
    node: process.version,
    region: process.env.VERCEL_REGION ?? "local",
    deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    timeoutMs,
    targets: CONNECTIVITY_TARGETS,
    samples,
  };
}
