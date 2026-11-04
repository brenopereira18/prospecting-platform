import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  CONNECTIVITY_DIAGNOSTIC_ATTEMPTS,
  CONNECTIVITY_DIAGNOSTIC_TIMEOUT_MS,
  CONNECTIVITY_TARGETS,
  runConnectivityDiagnostic,
} from "./connectivity-diagnostic";

test("diagnóstico repete apenas os dois alvos fixos e descarta os corpos", async () => {
  let cancelled = 0;
  const timeoutValues: number[] = [];
  const timeoutSignal = mock.fn((timeoutMs: number) => {
    timeoutValues.push(timeoutMs);
    return AbortSignal.timeout(timeoutMs);
  });
  const transport = mock.fn<typeof fetch>(async (url, options) => {
    assert.ok(
      Object.values(CONNECTIVITY_TARGETS).includes(
        String(url) as typeof CONNECTIVITY_TARGETS.control,
      ),
    );
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    assert.equal(options?.headers, undefined);
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      }),
    );
  });
  const result = await runConnectivityDiagnostic(transport, timeoutSignal);
  assert.equal(
    transport.mock.callCount(),
    Object.keys(CONNECTIVITY_TARGETS).length * CONNECTIVITY_DIAGNOSTIC_ATTEMPTS,
  );
  assert.deepEqual(
    timeoutValues,
    Array(6).fill(CONNECTIVITY_DIAGNOSTIC_TIMEOUT_MS),
  );
  assert.equal(cancelled, 6);
  for (const target of ["ibge", "control"]) {
    const samples = result.samples.filter((sample) => sample.target === target);
    assert.deepEqual(
      samples.map((sample) => sample.attempt),
      [1, 2, CONNECTIVITY_DIAGNOSTIC_ATTEMPTS],
    );
    assert.ok(
      samples.every(
        (sample) => sample.status === 200 && sample.errorType === null,
      ),
    );
    assert.ok(
      samples.every(
        (sample) =>
          Number.isFinite(Date.parse(sample.startedAt)) &&
          sample.durationMs >= 0,
      ),
    );
  }
});

test("falha consistente do IBGE não impede medir a API de controle", async () => {
  const result = await runConnectivityDiagnostic(async (url) => {
    if (url === CONNECTIVITY_TARGETS.ibge) {
      throw new TypeError("mensagem privada", {
        cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
      });
    }
    return Response.json({ private: "não expor" });
  });
  assert.equal(
    result.samples.filter((sample) => sample.status === 200).length,
    3,
  );
  const ibge = result.samples.filter((sample) => sample.target === "ibge");
  assert.ok(
    ibge.every(
      (sample) =>
        sample.status === null &&
        sample.errorType === "UND_ERR_CONNECT_TIMEOUT",
    ),
  );
  assert.ok(!JSON.stringify(result).includes("mensagem privada"));
  assert.ok(!JSON.stringify(result).includes("não expor"));
});

test("amostras preservam falha intermitente sem confundir timeout com HTTP", async () => {
  let attempt = 0;
  const result = await runConnectivityDiagnostic(async (url) => {
    if (url === CONNECTIVITY_TARGETS.control)
      return new Response(null, { status: 429 });
    if (++attempt === 2)
      throw new DOMException("tempo encerrado", "TimeoutError");
    return Response.json([]);
  });
  assert.deepEqual(
    result.samples
      .filter((sample) => sample.target === "ibge")
      .map((sample) => sample.status),
    [200, null, 200],
  );
  assert.ok(
    result.samples
      .filter((sample) => sample.target === "control")
      .every((sample) => sample.status === 429 && sample.errorType === null),
  );
  assert.equal(
    result.samples.find((sample) => sample.errorType)?.errorType,
    "TimeoutError",
  );
});

test("limita a três tentativas por destino e mantém os endereços fixos", async () => {
  const requested: string[] = [];
  const result = await runConnectivityDiagnostic(async (url) => {
    requested.push(String(url));
    return new Response(null, { status: 204 });
  });

  assert.equal(result.samples.length, 6);
  assert.deepEqual(
    new Set(requested),
    new Set(Object.values(CONNECTIVITY_TARGETS)),
  );
  for (const destination of Object.values(CONNECTIVITY_TARGETS)) {
    assert.equal(
      requested.filter((url) => url === destination).length,
      CONNECTIVITY_DIAGNOSTIC_ATTEMPTS,
    );
  }
});

test("timeout é reportado sem incluir mensagem, URL ou corpo da resposta", async () => {
  const result = await runConnectivityDiagnostic(async () => {
    throw new TypeError("mensagem que não deve ser exposta", {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
    });
  });

  assert.ok(result.samples.every((sample) => sample.status === null));
  assert.ok(
    result.samples.every(
      (sample) => sample.errorType === "UND_ERR_CONNECT_TIMEOUT",
    ),
  );
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("mensagem que não deve ser exposta"));
  assert.ok(!serialized.includes("cookie"));
  assert.ok(!serialized.includes("token"));
});
