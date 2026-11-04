// Development-only importer. Never imported by the application.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publishCatalog, restoreCatalog } from "./catalog-publication.mjs";

const base = "https://servicodados.ibge.gov.br/api/v1/localidades";
export async function collectCatalog(transport = fetch) {
  const sources = [];
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const fingerprint = (rows) =>
    hash(JSON.stringify([...rows].sort((a, b) => a.id - b.id)));
  const compare = (a, b) =>
    a.name.localeCompare(b.name, "pt-BR") || a.id - b.id;
  const text = (value) => {
    assert.equal(typeof value, "string");
    assert.ok(
      value.length > 0 && value === value.trim() && !value.includes("\uFFFD"),
    );
    return value;
  };
  async function download(path) {
    const url = `${base}/${path}?orderBy=nome`;
    const response = await transport(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    assert.equal(response.status, 200, `Falha ao obter ${url}`);
    const raw = await response.text();
    const rows = JSON.parse(raw);
    assert.ok(Array.isArray(rows) && rows.length > 0);
    sources.push({ url, sha256: hash(raw), count: rows.length });
    return rows;
  }

  const states = (await download("estados"))
    .map((row) => ({
      id: row.id,
      name: text(row.nome),
      abbreviation: text(row.sigla),
    }))
    .sort(compare);
  assert.equal(states.length, 27);
  assert.equal(new Set(states.map((row) => row.id)).size, 27);
  assert.equal(new Set(states.map((row) => row.abbreviation)).size, 27);
  for (const state of states) {
    assert.ok(Number.isInteger(state.id) && state.id >= 11 && state.id <= 53);
    assert.match(state.abbreviation, /^[A-Z]{2}$/);
  }
  function normalize(row) {
    // The newer regional hierarchy covers municipalities without a microrregiao.
    const current = row["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.id;
    const legacy = row.microrregiao?.mesorregiao?.UF?.id;
    if (current != null && legacy != null) assert.equal(current, legacy);
    const stateId = current ?? legacy;
    assert.ok(states.some((state) => state.id === stateId));
    assert.ok(Number.isInteger(row.id) && String(row.id).length === 7);
    assert.equal(Math.floor(row.id / 100000), stateId);
    return { id: row.id, name: text(row.nome), stateId };
  }
  const cities = (await download("municipios"))
    .map(normalize)
    .sort((a, b) => a.stateId - b.stateId || compare(a, b));
  assert.equal(new Set(cities.map((city) => city.id)).size, cities.length);

  // Independent completeness check: the national endpoint must exactly match
  // every UF endpoint, including names and UF associations, not just counts.
  const coverage = [];
  for (const state of states) {
    const national = cities.filter((city) => city.stateId === state.id);
    const regional = (await download(`estados/${state.id}/municipios`)).map(
      normalize,
    );
    assert.equal(
      fingerprint(national),
      fingerprint(regional),
      `Divergência na UF ${state.id}`,
    );
    coverage.push({
      stateId: state.id,
      count: regional.length,
      sha256: fingerprint(regional),
    });
  }
  const metadata = {
    retrievedAt: new Date().toISOString(),
    documentation: "https://servicodados.ibge.gov.br/api/docs/localidades",
    stateCount: states.length,
    cityCount: cities.length,
    statesSha256: fingerprint(states),
    citiesSha256: fingerprint(cities),
    coverage,
    sources,
  };
  return { states, cities, source: metadata };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  try {
    const result = process.argv.includes("--restore-previous")
      ? await restoreCatalog(directory)
      : await publishCatalog({ directory, generate: () => collectCatalog() });
    console.info(
      `Catálogo publicado: ${result.states.length} UFs e ${result.cities.length} municípios.`,
    );
  } catch (error) {
    console.error(
      "Atualização não concluída. O arquivo ativo permanece uma geração completa; valide-o antes de tentar novamente.",
      error.code ?? error.name,
    );
    process.exitCode = 1;
  }
}
