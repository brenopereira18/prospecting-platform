import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "../generated/prisma/client";
import {
  categorySeedRows,
  planCategorySeed,
  seedCategories,
  seedConnection,
} from "./category-seed";

test("snapshot local contém as 19 categorias e a chave real de Hamburgueria", () => {
  assert.equal(categorySeedRows.length, 19);
  assert.equal(new Set(categorySeedRows.map((row) => row.id)).size, 19);
  assert.equal(new Set(categorySeedRows.map((row) => row.name)).size, 19);
  assert.equal(
    categorySeedRows.find((row) => row.name === "Hamburgueria")
      ?.prototypeCategoryKey,
    "hamburgueria",
  );
  assert.ok(categorySeedRows.some((row) => row.name === "Buffer e eventos"));
});
test("banco vazio insere todos; repetição ignora todos", () => {
  assert.equal(planCategorySeed(categorySeedRows, []).insert.length, 19);
  const plan = planCategorySeed(categorySeedRows, categorySeedRows);
  assert.equal(plan.insert.length, 0);
  assert.equal(plan.skip.length, 19);
});
test("nome existente com outro ID e chave preserva dados e informa divergências", () => {
  const row = {
    ...categorySeedRows[0],
    id: randomUUID(),
    prototypeCategoryKey: "custom",
  };
  const before = structuredClone(row);
  const plan = planCategorySeed(categorySeedRows, [row]);
  assert.deepEqual(row, before);
  assert.equal(plan.insert.length, 18);
  assert.deepEqual(plan.skip[0].differences, ["id", "prototypeCategoryKey"]);
});
test("ID já atribuído a outro nome bloqueia o plano inteiro", () => {
  assert.throws(
    () =>
      planCategorySeed(categorySeedRows, [
        { ...categorySeedRows[0], name: "Nome existente diferente" },
      ]),
    /outra categoria/,
  );
});
test("duplicatas, UUIDs, datas e nomes inválidos são rejeitados sem normalizar", () => {
  assert.throws(() =>
    planCategorySeed([...categorySeedRows, categorySeedRows[0]], []),
  );
  for (const patch of [
    { id: "invalid" },
    { name: " nome " },
    { name: "" },
    { createdAt: "invalid" },
  ]) {
    assert.throws(() =>
      planCategorySeed([{ ...categorySeedRows[0], ...patch }], []),
    );
  }
});

function memoryDatabase(initial = categorySeedRows.slice(0, 0)) {
  let state = structuredClone(initial);
  const stats = { writes: 0, readOnly: 0 };
  const db = {
    $transaction: async (
      fn: (tx: unknown) => Promise<unknown>,
      options: { isolationLevel: string },
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      const draft = structuredClone(state);
      const result = await fn({
        $executeRaw: async () => {
          stats.readOnly++;
        },
        category: {
          findMany: async () => structuredClone(draft),
          createMany: async ({
            data,
            skipDuplicates,
          }: {
            data: Array<
              Omit<(typeof categorySeedRows)[number], "createdAt"> & {
                createdAt: Date;
              }
            >;
            skipDuplicates: boolean;
          }) => {
            assert.equal(skipDuplicates, true);
            stats.writes++;
            let count = 0;
            for (const row of data)
              if (
                !draft.some(
                  (existing) =>
                    existing.name === row.name || existing.id === row.id,
                )
              ) {
                assert.ok(row.createdAt instanceof Date);
                draft.push({ ...row, createdAt: row.createdAt.toISOString() });
                count++;
              }
            return { count };
          },
        },
      });
      state = draft;
      return result;
    },
  } as unknown as PrismaClient;
  return { db, stats, state: () => structuredClone(state) };
}
test("dry-run usa READ ONLY e não grava mesmo com banco vazio", async () => {
  const memory = memoryDatabase();
  const result = await seedCategories(memory.db);
  assert.equal(result.insert.length, 19);
  assert.equal(result.inserted, 0);
  assert.equal(memory.stats.writes, 0);
  assert.equal(memory.stats.readOnly, 1);
  assert.deepEqual(memory.state(), []);
});
test("apply insere somente ausentes, preserva existentes e repete sem duplicar", async () => {
  const existing = {
    ...categorySeedRows[0],
    prototypeCategoryKey: "preservar",
  };
  const memory = memoryDatabase([existing]);
  const first = await seedCategories(memory.db, true);
  assert.equal(first.inserted, 18);
  const before = memory.state();
  assert.deepEqual(
    before.find((row) => row.id === existing.id),
    existing,
  );
  const second = await seedCategories(memory.db, true);
  assert.equal(second.inserted, 0);
  assert.equal(memory.stats.writes, 1);
  assert.deepEqual(memory.state(), before);
});
test("falha no banco é propagada; conflitos de serialização têm limite de retries", async () => {
  let calls = 0;
  const db = {
    $transaction: async () => {
      calls++;
      throw { code: "P2034" };
    },
  } as unknown as PrismaClient;
  await assert.rejects(seedCategories(db, true));
  assert.equal(calls, 3);
  calls = 0;
  const broken = {
    $transaction: async () => {
      calls++;
      throw new Error("db failure");
    },
  } as unknown as PrismaClient;
  await assert.rejects(seedCategories(broken, true));
  assert.equal(calls, 1);
});
test("destinos local e produção exigem conexões explícitas e não se confundem", () => {
  const local = {
    DATABASE_URL: "postgresql://user:password@localhost:5432/prospecting_db",
  };
  const remote = {
    CATEGORY_DATABASE_URL:
      "postgresql://user:password@db.test.supabase.co:5432/postgres",
  };
  assert.equal(
    seedConnection("local", "DATABASE_URL", local).destination.host,
    "localhost",
  );
  assert.equal(
    seedConnection("production", "CATEGORY_DATABASE_URL", remote).destination
      .database,
    "postgres",
  );
  assert.throws(() => seedConnection("production", "DATABASE_URL", local));
  assert.throws(() => seedConnection("local", "CATEGORY_DATABASE_URL", remote));
  assert.throws(() =>
    seedConnection("production", "CATEGORY_DATABASE_URL", {}),
  );
  assert.throws(() => seedConnection(undefined, "DATABASE_URL", local));
});
