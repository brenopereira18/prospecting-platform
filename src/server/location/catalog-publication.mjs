// Development-only publisher for a local POSIX filesystem supporting rename/fsync.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";

export const fingerprint = (rows) =>
  createHash("sha256")
    .update(JSON.stringify([...rows].sort((a, b) => a.id - b.id)))
    .digest("hex");
export function validateCatalog(bundle) {
  const { states, cities, source } = bundle;
  assert.equal(states.length, 27);
  assert.equal(new Set(states.map((s) => s.id)).size, 27);
  assert.equal(new Set(states.map((s) => s.abbreviation)).size, 27);
  assert.equal(new Set(cities.map((c) => c.id)).size, cities.length);
  const compare = (a, b) =>
    a.name.localeCompare(b.name, "pt-BR") || a.id - b.id;
  assert.deepEqual(states, [...states].sort(compare));
  for (const row of [...states, ...cities]) {
    assert.ok(Number.isSafeInteger(row.id) && row.id > 0);
    assert.ok(
      typeof row.name === "string" &&
        row.name.trim() === row.name &&
        row.name.length &&
        !row.name.includes("\uFFFD"),
    );
  }
  for (const state of states) assert.match(state.abbreviation, /^[A-Z]{2}$/);
  for (const city of cities) {
    assert.equal(String(city.id).length, 7);
    assert.equal(Math.floor(city.id / 100000), city.stateId);
    assert.ok(states.some((s) => s.id === city.stateId));
  }
  assert.equal(source.stateCount, states.length);
  assert.equal(source.cityCount, cities.length);
  assert.equal(source.statesSha256, fingerprint(states));
  assert.equal(source.citiesSha256, fingerprint(cities));
  assert.ok(Number.isFinite(Date.parse(source.retrievedAt)));
  assert.equal(source.sources.length, 29);
  assert.equal(new Set(source.sources.map((s) => s.url)).size, 29);
  assert.equal(
    source.sources.find(
      (s) =>
        s.url ===
        "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
    )?.count,
    states.length,
  );
  assert.equal(
    source.sources.find(
      (s) =>
        s.url ===
        "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
    )?.count,
    cities.length,
  );
  assert.equal(source.coverage.length, 27);
  assert.equal(new Set(source.coverage.map((c) => c.stateId)).size, 27);
  for (const state of states) {
    const rows = cities.filter((c) => c.stateId === state.id);
    assert.ok(rows.length);
    assert.deepEqual(rows, [...rows].sort(compare));
    const coverage = source.coverage.find((c) => c.stateId === state.id);
    assert.equal(coverage.count, rows.length);
    assert.equal(coverage.sha256, fingerprint(rows));
    const origin = source.sources.find(
      (s) =>
        s.url ===
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios?orderBy=nome`,
    );
    assert.equal(origin?.count, rows.length);
  }
  for (const origin of source.sources) {
    assert.match(origin.sha256, /^[a-f0-9]{64}$/);
    assert.ok(
      origin.url.startsWith(
        "https://servicodados.ibge.gov.br/api/v1/localidades/",
      ),
    );
  }
  return bundle;
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function writeSynced(path, data) {
  const handle = await fs.open(path, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function publishCatalog({
  directory,
  generate,
  checkpoint = async () => {},
  restore = false,
}) {
  const lock = join(directory, ".catalog-update.lock");
  await fs.mkdir(lock); // Exclusive; never steal or automatically reclaim a lock.
  let staging;
  try {
    await fs.writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    staging = await fs.mkdtemp(join(directory, ".catalog-stage-"));
    const bundle = validateCatalog(await generate());
    await checkpoint("validated");
    const candidate = join(staging, "catalog.json");
    await checkpoint("before-write");
    await writeSynced(candidate, JSON.stringify(bundle, null, 2) + "\n");
    await checkpoint("written");
    validateCatalog(JSON.parse(await fs.readFile(candidate, "utf8")));
    const active = join(directory, "catalog.json");
    if (!restore) {
      const previous = await fs.readFile(active, "utf8");
      validateCatalog(JSON.parse(previous));
      const backup = join(staging, "previous.json");
      await writeSynced(backup, previous);
      await fs.rename(backup, join(directory, "catalog.previous.json"));
      await syncDirectory(directory);
    }
    await checkpoint("backup-ready");
    await checkpoint("before-publish");
    // Single commit point: data and provenance always move together.
    await fs.rename(candidate, active);
    await syncDirectory(directory);
    await checkpoint("published");
    return bundle;
  } finally {
    try {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
    } finally {
      await fs.rm(lock, { recursive: true, force: true });
    }
  }
}
export async function restoreCatalog(directory, checkpoint) {
  return publishCatalog({
    directory,
    restore: true,
    checkpoint,
    generate: async () =>
      JSON.parse(
        await fs.readFile(join(directory, "catalog.previous.json"), "utf8"),
      ),
  });
}
