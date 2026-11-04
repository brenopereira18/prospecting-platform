import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test } from "node:test";
import catalog from "./catalog.json";
const source = catalog.source;
import { LocationService } from "./location.service";
import { getCitiesByState } from "../../app/actions/location";

const fingerprint = (rows: { id: number }[]) =>
  createHash("sha256")
    .update(JSON.stringify([...rows].sort((a, b) => a.id - b.id)))
    .digest("hex");
const compare = (
  a: { id: number; name: string },
  b: { id: number; name: string },
) => a.name.localeCompare(b.name, "pt-BR") || a.id - b.id;

test("catálogo cobre integralmente as respostas oficiais nacional e por UF", () => {
  assert.equal(catalog.states.length, 27);
  assert.equal(source.stateCount, 27);
  assert.equal(catalog.cities.length, source.cityCount);
  assert.equal(source.cityCount, 5571);
  assert.equal(fingerprint(catalog.states), source.statesSha256);
  assert.equal(fingerprint(catalog.cities), source.citiesSha256);
  assert.equal(source.coverage.length, 27);
  assert.equal(source.sources.length, 29);
  assert.equal(
    source.sources.find((row) => row.url.includes("/localidades/municipios?"))
      ?.count,
    catalog.cities.length,
  );
  for (const state of catalog.states) {
    const coverage = source.coverage.find((row) => row.stateId === state.id);
    assert.ok(coverage);
    const cities = catalog.cities.filter((city) => city.stateId === state.id);
    assert.equal(cities.length, coverage.count);
    assert.equal(fingerprint(cities), coverage.sha256);
    assert.equal(
      source.sources.find((row) =>
        row.url.includes(`/estados/${state.id}/municipios?`),
      )?.count,
      cities.length,
    );
  }
});

test("códigos, nomes e vínculos são íntegros e únicos", () => {
  assert.equal(new Set(catalog.states.map((row) => row.id)).size, 27);
  assert.equal(new Set(catalog.states.map((row) => row.abbreviation)).size, 27);
  assert.equal(
    new Set(catalog.cities.map((row) => row.id)).size,
    catalog.cities.length,
  );
  for (const state of catalog.states)
    assert.match(state.abbreviation, /^[A-Z]{2}$/);
  for (const row of [...catalog.states, ...catalog.cities]) {
    assert.ok(Number.isSafeInteger(row.id) && row.id > 0);
    assert.equal(row.name, row.name.trim());
    assert.ok(row.name.length > 0 && !row.name.includes("\uFFFD"));
  }
  for (const city of catalog.cities) {
    assert.ok(catalog.states.some((state) => state.id === city.stateId));
    assert.equal(Math.floor(city.id / 100000), city.stateId);
    assert.equal(String(city.id).length, 7);
  }
  assert.deepEqual(catalog.states, [...catalog.states].sort(compare));
});

test("serviço e Server Action retornam todas as UFs e cidades sem acesso à rede", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  try {
    const service = new LocationService();
    for (const state of await service.listStates()) {
      const expected = catalog.cities
        .filter((city) => city.stateId === state.id)
        .map(({ id, name }) => ({ id, name }));
      const actual = await getCitiesByState(state.id);
      assert.deepEqual(actual, expected);
      assert.deepEqual(actual, [...actual].sort(compare));
    }
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.ok(
      (await getCitiesByState(31)).some(
        (city) => city.name === "Uberlândia" && city.id === 3170206,
      ),
    );
    assert.deepEqual(await getCitiesByState(53), [
      { id: 5300108, name: "Brasília" },
    ]);
  } finally {
    fetchMock.mock.restore();
  }
});

test("UF inválida ou sem resultados retorna lista vazia", async () => {
  for (const id of [NaN, Infinity, 0, -1, 99, 31.5])
    assert.deepEqual(await getCitiesByState(id), []);
});

test("trocar UF não mantém cidades anteriores e consumidores não alteram o catálogo", async () => {
  const service = new LocationService();
  const states = await service.listStates();
  const originalName = states[0].name;
  states[0].name = "alterado";
  assert.equal((await service.listStates())[0].name, originalName);
  const cities = await getCitiesByState(33);
  const originalCity = { ...cities[0] };
  cities[0].name = "alterado";
  cities.pop();
  assert.deepEqual((await getCitiesByState(33))[0], originalCity);
  const next = await getCitiesByState(35);
  assert.ok(next.every((city) => Math.floor(city.id / 100000) === 35));
});
