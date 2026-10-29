import { get, type RequestOptions } from "node:https";
import type { IncomingMessage, ClientRequest } from "node:http";
import states from "./states.json";

type RequestFactory = (
  url: URL,
  options: RequestOptions,
  callback: (response: IncomingMessage) => void,
) => ClientRequest;

type ProbeResult = {
  family: 4 | 6;
  phase: "dns" | "tcp" | "tls" | "http" | "response";
  durationMs: number;
  address?: string;
  status?: number;
  code?: string;
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
};

// Fixed public host and path only: no client URLs, credentials or response bodies.
export function probeIbgeHttps(
  stateId: number,
  family: 4 | 6,
  request: RequestFactory = get,
  timeoutMs = 3000,
): Promise<ProbeResult> {
  if (!states.some((state) => state.id === stateId)) {
    throw new Error("UF inválida para diagnóstico.");
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const result: ProbeResult = { family, phase: "dns", durationMs: 0 };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ...result, durationMs: Date.now() - started });
    };
    const url = new URL(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateId}/municipios?orderBy=nome`,
    );
    const req = request(
      url,
      {
        family,
        agent: false,
        headers: { "User-Agent": "Prospecta/IBGE-diagnostic" },
      },
      (response) => {
        result.phase = "response";
        result.status = response.statusCode;
        finish();
        response.destroy();
        req.destroy();
      },
    );
    req.on("socket", (socket) => {
      socket.once("lookup", (error, address) => {
        result.dnsMs = Date.now() - started;
        if (!error) {
          result.address = address;
          result.phase = "tcp";
        }
      });
      socket.once("connect", () => {
        result.tcpMs = Date.now() - started;
        result.phase = "tls";
      });
      socket.once("secureConnect", () => {
        result.tlsMs = Date.now() - started;
        result.phase = "http";
      });
    });
    req.once("error", (error: NodeJS.ErrnoException) => {
      result.code = error.code;
      finish();
    });
    const timer = setTimeout(() => {
      result.code = "PROBE_TIMEOUT";
      finish();
      req.destroy();
    }, timeoutMs);
  });
}

let lastRun = 0;

// One diagnostic per warm instance every five minutes, even during concurrent failures.
export async function logIbgeNetworkDiagnostics(stateId: number) {
  if (
    !states.some((state) => state.id === stateId) ||
    Date.now() - lastRun < 300000
  )
    return;
  lastRun = Date.now();
  try {
    const probes = await Promise.all([
      probeIbgeHttps(stateId, 4),
      probeIbgeHttps(stateId, 6),
    ]);
    console.info(
      "[location:ibge:diagnostic]",
      JSON.stringify({
        stateId,
        region: process.env.VERCEL_REGION ?? "local",
        node: process.version,
        probes,
      }),
    );
  } catch {
    console.warn(
      "[location:ibge:diagnostic] Não foi possível concluir o diagnóstico.",
    );
  }
}
