import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { test } from "node:test";
import { probeIbgeHttps } from "./location-diagnostics";

type RequestFactory = NonNullable<Parameters<typeof probeIbgeHttps>[2]>;

for (const family of [4, 6] as const) {
  test(`sondagem IPv${family} registra conexão e resposta sem ler corpo`, async () => {
    const req = new EventEmitter() as ClientRequest;
    let destroyed = false;
    req.destroy = () => {
      destroyed = true;
      return req;
    };
    const request: RequestFactory = (url, options, callback) => {
      assert.equal(url.hostname, "servicodados.ibge.gov.br");
      assert.equal(url.pathname, "/api/v1/localidades/estados/33/municipios");
      assert.equal(options.family, family);
      assert.equal(options.agent, false);
      queueMicrotask(() => {
        const socket = new EventEmitter();
        req.emit("socket", socket);
        socket.emit("lookup", null, family === 4 ? "192.0.2.1" : "2001:db8::1");
        socket.emit("connect");
        socket.emit("secureConnect");
        callback({ statusCode: 200, destroy() {} } as IncomingMessage);
      });
      return req;
    };
    const result = await probeIbgeHttps(33, family, request);
    assert.equal(result.phase, "response");
    assert.equal(result.status, 200);
    assert.equal(result.family, family);
    assert.equal(typeof result.dnsMs, "number");
    assert.equal(typeof result.tcpMs, "number");
    assert.equal(typeof result.tlsMs, "number");
    assert.ok(destroyed);
  });
}

for (const phase of ["dns", "tcp", "tls", "http"] as const) {
  test(`sondagem identifica falha na etapa ${phase} sem expor mensagem arbitrária`, async () => {
    const request: RequestFactory = () => {
      const req = new EventEmitter() as ClientRequest;
      queueMicrotask(() => {
        const socket = new EventEmitter();
        req.emit("socket", socket);
        if (phase !== "dns") socket.emit("lookup", null, "192.0.2.1");
        if (phase === "tls" || phase === "http") socket.emit("connect");
        if (phase === "http") socket.emit("secureConnect");
        req.emit(
          "error",
          Object.assign(new Error("conteúdo privado"), { code: "ECONNRESET" }),
        );
      });
      return req;
    };
    const result = await probeIbgeHttps(33, 4, request);
    assert.equal(result.phase, phase);
    assert.equal(result.code, "ECONNRESET");
    assert.ok(!JSON.stringify(result).includes("conteúdo privado"));
  });
}

test("sondagem encerra requisição travada no limite de tempo", async () => {
  const req = new EventEmitter() as ClientRequest;
  let destroyed = false;
  req.destroy = () => {
    destroyed = true;
    return req;
  };
  const result = await probeIbgeHttps(33, 4, () => req, 10);
  assert.equal(result.code, "PROBE_TIMEOUT");
  assert.ok(destroyed);
});

test("UF inválida é rejeitada antes de iniciar conexão", () => {
  assert.throws(() => probeIbgeHttps(99, 4), /UF inválida/);
});
