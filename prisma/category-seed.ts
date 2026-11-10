import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import snapshot from "./data/categories.json";

const categorySchema = z
  .object({
    id: z.uuid(),
    name: z
      .string()
      .min(1)
      .refine((name) => name === name.trim()),
    prototypeCategoryKey: z.string().min(1).nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
const rowsSchema = z
  .array(categorySchema)
  .min(1)
  .superRefine((rows, ctx) => {
    for (const field of ["id", "name"] as const) {
      if (new Set(rows.map((row) => row[field])).size !== rows.length)
        ctx.addIssue({
          code: "custom",
          message: `Duplicação de ${field} na origem.`,
        });
    }
  });
export type CategorySeedRow = z.infer<typeof categorySchema>;
export class CategorySeedError extends Error {}
export const categorySeedRows = rowsSchema.parse(snapshot.categories);

type ExistingCategory = {
  id: string;
  name: string;
  prototypeCategoryKey: string | null;
};
export function planCategorySeed(input: unknown, existing: ExistingCategory[]) {
  const rows = rowsSchema.parse(input);
  const byName = new Map(existing.map((row) => [row.name, row]));
  const byId = new Map(existing.map((row) => [row.id, row]));
  const insert: CategorySeedRow[] = [];
  const skip: { name: string; id: string; differences: string[] }[] = [];
  for (const row of rows) {
    const idOwner = byId.get(row.id);
    if (idOwner && idOwner.name !== row.name)
      throw new CategorySeedError(
        `ID da origem já pertence a outra categoria: ${row.id}. Nenhum registro será alterado.`,
      );
    const current = byName.get(row.name);
    if (current) {
      skip.push({
        name: current.name,
        id: current.id,
        differences: [
          ...(current.id !== row.id ? ["id"] : []),
          ...(current.prototypeCategoryKey !== row.prototypeCategoryKey
            ? ["prototypeCategoryKey"]
            : []),
        ],
      });
    } else insert.push(row);
  }
  return { totalBefore: existing.length, insert, skip };
}

export async function seedCategories(db: PrismaClient, apply = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
          const existing = await tx.category.findMany({
            orderBy: [{ name: "asc" }, { id: "asc" }],
          });
          const plan = planCategorySeed(categorySeedRows, existing);
          if (!apply)
            return { ...plan, inserted: 0, totalAfter: existing.length };
          // INSERT only. Unique name/id constraints resolve concurrent inserts;
          // no UPDATE, DELETE or changes to related entities are performed.
          const result = plan.insert.length
            ? await tx.category.createMany({
                data: plan.insert.map((row) => ({
                  ...row,
                  createdAt: new Date(row.createdAt),
                })),
                skipDuplicates: true,
              })
            : { count: 0 };
          const after = await tx.category.findMany({
            orderBy: [{ name: "asc" }, { id: "asc" }],
          });
          const remaining = planCategorySeed(categorySeedRows, after);
          if (remaining.insert.length)
            throw new CategorySeedError(
              "Categorias ausentes após inserção; transação cancelada.",
            );
          return { ...plan, inserted: result.count, totalAfter: after.length };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2034"
      )
        continue;
      throw error;
    }
  }
}

export function seedConnection(
  target: string | undefined,
  variable: string,
  env: Record<string, string | undefined>,
) {
  if (target !== "local" && target !== "production")
    throw new CategorySeedError(
      "Informe --target local ou --target production.",
    );
  if (!/^[A-Z][A-Z0-9_]*$/.test(variable))
    throw new CategorySeedError("Nome de variável inválido.");
  if (target === "production" && variable === "DATABASE_URL")
    throw new CategorySeedError(
      "Produção exige uma variável separada, como CATEGORY_DATABASE_URL; preserve DATABASE_URL local.",
    );
  const value = env[variable];
  if (!value) throw new CategorySeedError(`Conexão ausente em ${variable}.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CategorySeedError("Conexão inválida; nenhum banco acessado.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new CategorySeedError("A conexão deve ser PostgreSQL.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (target === "local" && !local)
    throw new CategorySeedError("Operação local exige conexão loopback.");
  if (
    target === "production" &&
    !/(^|\.)supabase\.(co|com)$/.test(url.hostname)
  )
    throw new CategorySeedError(
      "Operação de produção exige host Supabase explícito.",
    );
  return {
    connectionString: value,
    destination: {
      target,
      variable,
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.slice(1),
    },
  };
}
