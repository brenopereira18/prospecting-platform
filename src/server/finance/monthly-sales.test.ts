import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { monthlySalesGoalSchema } from "./monthly-sales.schema";
import { MonthlySalesService } from "./monthly-sales.service";
import { createSaveMonthlyGoalAction } from "./monthly-sales-action";

const now = new Date("2026-10-26T15:00:00Z");
function fixture(sold = "0", amount: string | null = null, saleCount = 0) {
  const reads: unknown[] = [];
  const writes: unknown[] = [];
  const queries: Prisma.Sql[] = [];
  const db = {
    $queryRaw: async (query: Prisma.Sql) => {
      queries.push(query);
      return [
        {
          sold: new Prisma.Decimal(sold),
          saleCount,
          clients: saleCount ? 1 : 0,
        },
      ];
    },
    monthlySalesGoal: {
      findUnique: async (input: unknown) => {
        reads.push(input);
        return amount === null ? null : { amount: new Prisma.Decimal(amount) };
      },
      upsert: async (input: unknown) => {
        writes.push(input);
      },
    },
  } as unknown as PrismaClient;
  return { service: new MonthlySalesService(db), reads, writes, queries };
}

test("goal accepts exact decimal strings and rejects zero, invalid values, months and client ownership", () => {
  assert.deepEqual(
    monthlySalesGoalSchema.parse({ month: "2026-10", amount: " 5000,01 " }),
    { month: "2026-10", amount: "5000.01" },
  );
  for (const amount of [
    "0",
    "-1",
    "1.001",
    "Infinity",
    "NaN",
    "1e3",
    "10000000000",
    "",
    100,
  ])
    assert.equal(
      monthlySalesGoalSchema.safeParse({ month: "2026-10", amount }).success,
      false,
    );
  for (const month of ["2026-13", "2026-1", "2026-10-01", "0000-01"])
    assert.equal(
      monthlySalesGoalSchema.safeParse({ month, amount: "1" }).success,
      false,
    );
  assert.equal(
    monthlySalesGoalSchema.safeParse({
      month: "2026-10",
      amount: "1",
      userId: "other",
    }).success,
    false,
  );
});

test("no goal remains unconfigured and an empty month has zero sales without division by zero", async () => {
  const f = fixture();
  const data = await f.service.getByUser("owner", "2026-10", now);
  assert.equal(data.goal, null);
  assert.equal(data.percentage, null);
  assert.equal(data.remaining, null);
  assert.equal(data.sold, "0.00");
  assert.equal(data.averageTicket, "0.00");
  assert.equal(data.clients, 0);
});

test("goal progress and remaining money are exact below, at and above 100 percent", async () => {
  for (const [sold, percentage, remaining, exceeded] of [
    ["0", 0, "100.00", "0.00"],
    ["25.01", 25, "74.99", "0.00"],
    ["100", 100, "0.00", "0.00"],
    ["250.50", 250.5, "0.00", "150.50"],
  ] as const) {
    const data = await fixture(sold, "100", 2).service.getByUser(
      "owner",
      "2026-10",
      now,
    );
    assert.equal(data.percentage, percentage);
    assert.equal(data.remaining, remaining);
    assert.equal(data.exceeded, exceeded);
  }
});

test("ticket is calculated per sale, not per distinct client, with monetary rounding", async () => {
  const data = await fixture("100.01", null, 3).service.getByUser(
    "owner",
    "2026-10",
    now,
  );
  assert.equal(data.averageTicket, "33.34");
  assert.equal(data.clients, 1);
  assert.equal(data.saleCount, 3);
});

test("calendar DATE bounds include the first day and cross December without applying timestamp offsets", async () => {
  const f = fixture();
  await f.service.getByUser("owner", "2025-12", now);
  assert.deepEqual(f.queries[0].values, [
    "owner",
    "owner",
    new Date("2025-12-01T00:00:00Z"),
    new Date("2026-01-01T00:00:00Z"),
  ]);
  assert.match(f.queries[0].sql, /COUNT\(DISTINCT s\."leadId"\)/);
  assert.doesNotMatch(f.queries[0].sql, /receipts|receivables|createdAt/);
  assert.deepEqual(f.reads[0], {
    where: {
      userId_month: {
        userId: "owner",
        month: new Date("2025-12-01T00:00:00Z"),
      },
    },
  });
  const local = await f.service.getByUser(
    "owner",
    undefined,
    new Date("2026-11-01T01:00:00Z"),
  );
  assert.equal(local.month, "2026-10");
});

test("save validates again, scopes the atomic upsert by session owner and preserves other months", async () => {
  const f = fixture();
  await f.service.saveGoal({ month: "2026-10", amount: "100,01" }, "owner");
  assert.deepEqual(f.writes[0], {
    where: {
      userId_month: {
        userId: "owner",
        month: new Date("2026-10-01T00:00:00Z"),
      },
    },
    create: {
      userId: "owner",
      month: new Date("2026-10-01T00:00:00Z"),
      amount: new Prisma.Decimal("100.01"),
    },
    update: { amount: new Prisma.Decimal("100.01") },
  });
  await assert.rejects(
    f.service.saveGoal({ month: "2026-10", amount: "0" }, "owner"),
  );
  await assert.rejects(
    f.service.saveGoal({ month: "2026-10", amount: "10" }, ""),
  );
  await assert.rejects(f.service.getByUser("", "2026-10", now));
  assert.equal(f.writes.length, 1);
  assert.equal(f.queries.length, 0);
});

test("action authenticates, rejects forged userIds and only invalidates after successful persistence", async () => {
  let authenticated = false;
  const calls: unknown[] = [];
  const action = createSaveMonthlyGoalAction({
    getUser: async () => (authenticated ? { id: "session-owner" } : null),
    service: {
      saveGoal: async (input, userId) => {
        calls.push([input, userId]);
      },
    },
    invalidate: () => {
      calls.push("invalidate");
    },
  });
  assert.equal(
    (await action({ month: "2026-10", amount: "20" })).success,
    false,
  );
  authenticated = true;
  assert.equal(
    (await action({ month: "2026-10", amount: "20", userId: "victim" }))
      .success,
    false,
  );
  assert.equal(calls.length, 0);
  const invalid = await action({ month: "2026-10", amount: "0" });
  assert.ok(!invalid.success && invalid.fields?.amount);
  assert.deepEqual(await action({ month: "2026-10", amount: "20,01" }), {
    success: true,
  });
  assert.deepEqual(calls, [
    [{ month: "2026-10", amount: "20.01" }, "session-owner"],
    "invalidate",
  ]);
});

test("persistence failure is actionable and never reported as success or leaked", async (t) => {
  t.mock.method(console, "error", () => {});
  const action = createSaveMonthlyGoalAction({
    getUser: async () => ({ id: "owner" }),
    service: {
      saveGoal: async () => {
        throw new Error("private-db-details");
      },
    },
    invalidate: () => assert.fail("must not invalidate"),
  });
  const result = await action({ month: "2026-10", amount: "20" });
  assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), /private-db-details/);
});
