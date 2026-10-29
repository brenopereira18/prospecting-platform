import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { CONNECTIVITY_TARGETS, runConnectivityDiagnostic } from "./connectivity-diagnostic";

test("diagnóstico repete apenas os dois alvos fixos e descarta os corpos", async () => {
  let cancelled = 0;
  const transport = mock.fn<typeof fetch>(async (url, options) => {
    assert.ok(Object.values(CONNECTIVITY_TARGETS).includes(String(url) as typeof CONNECTIVITY_TARGETS.control));
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    assert.equal(options?.headers, undefined);
    return new Response(new ReadableStream({ cancel() { cancelled++; } }));
  });
  const result = await runConnectivityDiagnostic(transport);
  assert.equal(transport.mock.callCount(), 6);
  assert.equal(cancelled, 6);
  for (const target of ["ibge", "control"]) {
    const samples = result.samples.filter((sample) => sample.target === target);
    assert.deepEqual(samples.map((sample) => sample.attempt), [1, 2, 3]);
    assert.ok(samples.every((sample) => sample.status === 200 && sample.errorType === null));
    assert.ok(samples.every((sample) => Number.isFinite(Date.parse(sample.startedAt)) && sample.durationMs >= 0));
  }
});

test("falha consistente do IBGE não impede medir a API de controle", async () => {
  const result = await runConnectivityDiagnostic(async (url) => {
    if (url === CONNECTIVITY_TARGETS.ibge) {
      throw new TypeError("mensagem privada", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    }
    return Response.json({ private: "não expor" });
  });
  assert.equal(result.samples.filter((sample) => sample.status === 200).length, 3);
  const ibge = result.samples.filter((sample) => sample.target === "ibge");
  assert.ok(ibge.every((sample) => sample.status === null && sample.errorType === "UND_ERR_CONNECT_TIMEOUT"));
  assert.ok(!JSON.stringify(result).includes("mensagem privada"));
  assert.ok(!JSON.stringify(result).includes("não expor"));
});

test("amostras preservam falha intermitente sem confundir timeout com HTTP", async () => {
  let attempt = 0;
  const result = await runConnectivityDiagnostic(async (url) => {
    if (url === CONNECTIVITY_TARGETS.control) return new Response(null, { status: 429 });
    if (++attempt === 2) throw new DOMException("tempo encerrado", "TimeoutError");
    return Response.json([]);
  });
  assert.deepEqual(result.samples.filter((sample) => sample.target === "ibge").map((sample) => sample.status), [200, null, 200]);
  assert.ok(result.samples.filter((sample) => sample.target === "control").every((sample) => sample.status === 429 && sample.errorType === null));
  assert.equal(result.samples.find((sample) => sample.errorType)?.errorType, "TimeoutError");
});
