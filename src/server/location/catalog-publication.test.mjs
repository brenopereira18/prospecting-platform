import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  publishCatalog,
  restoreCatalog,
  validateCatalog,
  fingerprint,
} from "./catalog-publication.mjs";
import { collectCatalog } from "./update-catalog.mjs";
const original = JSON.parse(
  await fs.readFile(new URL("./catalog.json", import.meta.url), "utf8"),
);
const moduleUrl = new URL("./catalog-publication.mjs", import.meta.url).href;
function revised() {
  const data = structuredClone(original);
  data.cities[0].name += " Atualizado";
  data.cities.sort(
    (a, b) =>
      a.stateId - b.stateId ||
      a.name.localeCompare(b.name, "pt-BR") ||
      a.id - b.id,
  );
  data.source.citiesSha256 = fingerprint(data.cities);
  for (const entry of data.source.coverage)
    entry.sha256 = fingerprint(
      data.cities.filter((c) => c.stateId === entry.stateId),
    );
  return validateCatalog(data);
}
async function fixture(t) {
  const dir = await fs.mkdtemp(join(tmpdir(), "prospecta-catalog-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(join(dir, "catalog.json"), JSON.stringify(original));
  return dir;
}
async function read(dir, name = "catalog.json") {
  return validateCatalog(
    JSON.parse(await fs.readFile(join(dir, name), "utf8")),
  );
}
function officialTransport(failLast = false) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/estados"))
      return Response.json(
        original.states.map((s) => ({
          id: s.id,
          nome: s.name,
          sigla: s.abbreviation,
        })),
      );
    const stateId = Number(path.match(/estados\/(\d+)\/municipios/)?.[1]);
    const rows = original.cities
      .filter((c) => !stateId || c.stateId === stateId)
      .map((c) => ({
        id: c.id,
        nome: c.name,
        "regiao-imediata": {
          "regiao-intermediaria": { UF: { id: c.stateId } },
        },
      }));
    if (failLast && stateId === 17) rows.pop();
    return Response.json(rows);
  };
}
test("coleta completa gera dados e metadados correspondentes com 29 respostas simuladas", async () => {
  const result = validateCatalog(await collectCatalog(officialTransport()));
  assert.deepEqual(result.states, original.states);
  assert.deepEqual(result.cities, original.cities);
  assert.equal(result.source.sources.length, 29);
});
test("divergência tardia da coleta por UF preserva o ativo", async (t) => {
  const directory = await fixture(t);
  await assert.rejects(
    publishCatalog({
      directory,
      generate: () => collectCatalog(officialTransport(true)),
    }),
  );
  assert.deepEqual(await read(directory), original);
});
for (const stage of [
  "generation",
  "metadata",
  "validation",
  "partial-write",
  "publication",
]) {
  test(`falha ${stage} preserva dados e metadados ativos`, async (t) => {
    const directory = await fixture(t);
    await assert.rejects(
      publishCatalog({
        directory,
        generate: async () => {
          if (stage === "generation") throw new Error("generation");
          const result = revised();
          if (stage === "metadata") throw new Error("metadata");
          if (stage === "validation") result.source.citiesSha256 = "invalid";
          return result;
        },
        checkpoint: async (name) => {
          if (stage === "partial-write" && name === "before-write") {
            const staging = (await fs.readdir(directory)).find((n) =>
              n.startsWith(".catalog-stage-"),
            );
            await fs.writeFile(
              join(directory, staging, "catalog.json"),
              "{partial",
            );
          }
          if (stage === "publication" && name === "before-publish") {
            const staging = (await fs.readdir(directory)).find((n) =>
              n.startsWith(".catalog-stage-"),
            );
            await fs.unlink(join(directory, staging, "catalog.json")); // Real rename fails with ENOENT.
          }
        },
      }),
    );
    assert.deepEqual(await read(directory), original);
  });
}
test("falha real de coleta/timeout não escreve estado ativo", async (t) => {
  const directory = await fixture(t);
  await assert.rejects(
    publishCatalog({
      directory,
      generate: () =>
        collectCatalog(async () => {
          throw new DOMException("timeout", "TimeoutError");
        }),
    }),
  );
  assert.deepEqual(await read(directory), original);
});
test("sucesso e recuperação preservam gerações inteiras", async (t) => {
  const directory = await fixture(t);
  const next = revised();
  await publishCatalog({ directory, generate: async () => next });
  assert.deepEqual(await read(directory), next);
  assert.deepEqual(await read(directory, "catalog.previous.json"), original);
  // Even a damaged active file can be recovered from the verified backup.
  await fs.writeFile(join(directory, "catalog.json"), "{damaged");
  await restoreCatalog(directory);
  assert.deepEqual(await read(directory), original);
  assert.deepEqual(await read(directory, "catalog.previous.json"), original);
});
test("concorrência é rejeitada antes da geração e não remove lock alheio", async (t) => {
  const directory = await fixture(t);
  let release;
  let entered;
  const ready = new Promise((r) => {
    entered = r;
  });
  const gate = new Promise((r) => {
    release = r;
  });
  const first = publishCatalog({
    directory,
    generate: async () => {
      entered();
      await gate;
      return revised();
    },
  });
  await ready;
  await assert.rejects(
    publishCatalog({
      directory,
      generate: async () => {
        assert.fail("second generator executed");
      },
    }),
    { code: "EEXIST" },
  );
  await fs.access(join(directory, ".catalog-update.lock"));
  release();
  await first;
  assert.deepEqual(await read(directory), revised());
});
for (const stage of [
  "validated",
  "before-write",
  "written",
  "backup-ready",
  "before-publish",
  "published",
]) {
  test(`SIGKILL em ${stage} deixa ativo completo e recuperável`, async (t) => {
    const directory = await fixture(t);
    const next = revised();
    await fs.writeFile(join(directory, "candidate.json"), JSON.stringify(next));
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
   import * as fs from 'node:fs/promises';
   import {publishCatalog} from ${JSON.stringify(moduleUrl)};
   await publishCatalog({directory:process.argv[1],generate:async()=>JSON.parse(await fs.readFile(process.argv[1]+'/candidate.json','utf8')),checkpoint:async name=>{
    if(name===process.argv[2]) {console.log('READY');await new Promise(()=>setInterval(()=>{},1000));}
   }});
  `,
        directory,
        stage,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("child timeout: " + stderr));
      }, 10000);
      child.stdout.once("data", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("premature exit: " + stderr));
      });
    });
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    assert.deepEqual(
      await read(directory),
      stage === "published" ? next : original,
    );
    await assert.rejects(
      publishCatalog({ directory, generate: async () => next }),
      { code: "EEXIST" },
    );
    if (["backup-ready", "before-publish", "published"].includes(stage))
      assert.deepEqual(
        await read(directory, "catalog.previous.json"),
        original,
      );
    // Explicit operator cleanup AFTER confirming the process exited; never auto-steal.
    await fs.rm(join(directory, ".catalog-update.lock"), { recursive: true });
    if (stage === "published") {
      await restoreCatalog(directory);
      assert.deepEqual(await read(directory), original);
    } else {
      await publishCatalog({ directory, generate: async () => next });
      assert.deepEqual(await read(directory), next);
    }
  });
}
