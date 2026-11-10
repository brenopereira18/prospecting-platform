import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../lib/prisma/client";
import { CategoryService } from "../src/server/categories/category.service";
import { compatibleTemplates } from "../src/server/prototypes/template-registry";
import {
  categorySeedRows,
  seedCategories,
  seedConnection,
} from "./category-seed";

test(
  "seed PostgreSQL local preserva existentes, consumidores e idempotência",
  {
    skip:
      process.env.CATEGORY_SEED_LOCAL_TEST !== "1" &&
      "Defina CATEGORY_SEED_LOCAL_TEST=1 com o Docker local disponível.",
  },
  async () => {
    seedConnection("local", "DATABASE_URL", process.env);
    const read = () => prisma.category.findMany({ orderBy: { id: "asc" } });
    try {
      const before = await read();
      await seedCategories(prisma, true);
      const after = await read();
      for (const previous of before)
        assert.deepEqual(
          after.find((row) => row.id === previous.id),
          previous,
        );
      for (const source of categorySeedRows)
        assert.ok(after.some((row) => row.name === source.name));
      assert.equal(new Set(after.map((row) => row.name)).size, after.length);
      assert.equal((await seedCategories(prisma, true)).inserted, 0);
      assert.deepEqual(await read(), after);
      const consumer = await new CategoryService().list();
      assert.deepEqual(
        new Set(consumer.map((row) => row.id)),
        new Set(after.map((row) => row.id)),
      );
      const burger = after.find((row) => row.name === "Hamburgueria");
      assert.ok(burger);
      assert.deepEqual(
        compatibleTemplates(burger.prototypeCategoryKey).map((row) => row.id),
        ["brasa-burger"],
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
