import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { fetchCitiesByState, LocationService } from "./location.service";

test("estados oficiais continuam disponíveis com a rede indisponível", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  try {
    const service = new LocationService();
    const states = await service.listStates();
    assert.equal(states.length, 27);
    assert.equal(new Set(states.map((state) => state.id)).size, 27);
    assert.deepEqual(
      states.find((state) => state.id === 31),
      {
        id: 31,
        name: "Minas Gerais",
        abbreviation: "MG",
      },
    );
    assert.deepEqual(
      states.find((state) => state.id === 53),
      {
        id: 53,
        name: "Distrito Federal",
        abbreviation: "DF",
      },
    );
    states[0].name = "alterado";
    assert.notEqual((await service.listStates())[0].name, "alterado");
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
  }
});

test("municípios preservam códigos oficiais, ordenação e consulta por UF", async () => {
  const transport = mock.fn<typeof fetch>(async (url, init) => {
    assert.equal(
      url,
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios?orderBy=nome",
    );
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json([
      { id: 3170206, nome: "Uberlândia" },
      { id: 3106200, nome: "Belo Horizonte" },
    ]);
  });
  const service = new LocationService((id) =>
    fetchCitiesByState(id, transport),
  );
  assert.deepEqual(await service.listCitiesByState(31), [
    { id: 3106200, name: "Belo Horizonte" },
    { id: 3170206, name: "Uberlândia" },
  ]);
  assert.equal(transport.mock.callCount(), 1);
});

test("UF inválida não inicia consulta externa", async () => {
  const loader = mock.fn(async () => []);
  const service = new LocationService(loader);
  for (const id of [NaN, Infinity, 0, -1, 99, 31.5]) {
    assert.deepEqual(await service.listCitiesByState(id), []);
  }
  assert.equal(loader.mock.callCount(), 0);
});

const failures: [string, typeof fetch][] = [
  [
    "timeout",
    async () => {
      throw new DOMException("timeout", "TimeoutError");
    },
  ],
  [
    "conexão",
    async () => {
      throw new TypeError("segredo não deve aparecer", {
        cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
      });
    },
  ],
  ["HTTP 503", async () => new Response("payload privado", { status: 503 })],
  ["JSON inválido", async () => new Response("não é JSON")],
  ["lista vazia", async () => Response.json([])],
  [
    "formato inválido",
    async () => Response.json([{ id: "3106200", nome: "BH" }]),
  ],
  [
    "município de outra UF",
    async () => Response.json([{ id: 3550308, nome: "São Paulo" }]),
  ],
];

for (const [name, transport] of failures) {
  test(`falha de ${name} gera erro tratável e log seguro`, async () => {
    const warning = mock.method(console, "warn", () => {});
    try {
      await assert.rejects(
        fetchCitiesByState(31, transport),
        /Não foi possível carregar os municípios/,
      );
      assert.equal(warning.mock.callCount(), 1);
      const output = JSON.stringify(warning.mock.calls[0].arguments);
      assert.ok(output.includes('"stateId":31'));
      assert.ok(!output.includes("segredo"));
      assert.ok(!output.includes("payload privado"));
      if (name === "conexão")
        assert.ok(output.includes("UND_ERR_CONNECT_TIMEOUT"));
    } finally {
      warning.mock.restore();
    }
  });
}
