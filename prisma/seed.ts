import "dotenv/config";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  CategorySeedError,
  seedCategories,
  seedConnection,
} from "./category-seed";
import { seedErrorDiagnostic } from "./seed-diagnostic";

let diagnosticConnection: string | undefined;

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: "string" },
      "database-env": { type: "string" },
      apply: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (values.apply && values["dry-run"])
    throw new CategorySeedError("Use --apply ou --dry-run, nunca ambos.");
  const variable =
    values["database-env"] ??
    (values.target === "production" ? "CATEGORY_DATABASE_URL" : "DATABASE_URL");
  diagnosticConnection = process.env[variable];
  const { connectionString, destination } = seedConnection(
    values.target,
    variable,
    process.env,
  );
  console.info(
    JSON.stringify({
      mode: values.apply ? "apply" : "dry-run (READ ONLY)",
      destination,
    }),
  );
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  });
  let operationFailed = false;
  try {
    const result = await seedCategories(db, values.apply);
    console.info(
      JSON.stringify(
        {
          totalBefore: result.totalBefore,
          totalAfter: result.totalAfter,
          inserted: result.inserted,
          wouldInsert: result.insert.map(({ name }) => name),
          skipped: result.skip,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      await db.$disconnect();
    } catch (error) {
      // Cleanup must not replace the original connection/query exception.
      if (!operationFailed) throw error;
      console.error(
        "Falha adicional ao encerrar a conexão:",
        JSON.stringify(seedErrorDiagnostic(error, diagnosticConnection)),
      );
    }
  }
}
main().catch((error: unknown) => {
  console.error(
    "Seed não concluído:",
    JSON.stringify(seedErrorDiagnostic(error, diagnosticConnection), null, 2),
  );
  process.exitCode = 1;
});
