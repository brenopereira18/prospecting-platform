import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../../../generated/prisma/client";
import {
  LeadMonthlyService,
  STATUS_HISTORY_MIGRATION,
} from "./lead-monthly.service";

function fixture(since: Date | null = new Date("2026-08-01T03:00:00Z")) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const counts: unknown[] = [];
  const registrations: { userId: string; createdAt: Date }[] = [];
  const events: {
    status: string;
    total: number;
    current: number;
    previous: number;
  }[] = [];
  const db = {
    lead: {
      count: async (args: {
        where: { userId: string; createdAt: { gte: Date; lt: Date } };
      }) => {
        counts.push(args);
        const { userId, createdAt: range } = args.where;
        return registrations.filter(
          (row) =>
            row.userId === userId &&
            row.createdAt >= range.gte &&
            row.createdAt < range.lt,
        ).length;
      },
    },
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const query = sql.join("?");
      calls.push({ sql: query, values });
      return query.includes("_prisma_migrations") ? [{ since }] : events;
    },
  } as unknown as Pick<PrismaClient, "lead" | "$queryRaw">;
  return {
    service: new LeadMonthlyService(db),
    registrations,
    events,
    calls,
    counts,
  };
}
const now = new Date("2026-11-15T15:00:00Z");

test("empty covered months return real zeroes, stable comparisons and scoped aggregate queries", async () => {
  const { service, calls, counts } = fixture();
  const result = await service.getByUser("alice", "2026-10", now);
  for (const metric of Object.values(result.metrics)) {
    assert.equal(metric.current, 0);
    assert.equal(metric.previous, 0);
    assert.equal(metric.comparison, "stable");
  }
  assert.equal(counts.length, 2);
  assert.ok(calls[0].values.includes(STATUS_HISTORY_MIGRATION));
  assert.match(
    calls[0].sql,
    /finished_at IS NOT NULL AND rolled_back_at IS NULL/,
  );
  assert.match(calls[1].sql, /COUNT\(DISTINCT h\."leadId"\)/);
  assert.match(calls[1].sql, /l\."userId" = \?/);
  assert.ok(calls[1].values.includes("alice"));
  assert.doesNotMatch(calls[1].sql, /updatedAt|l\."status"/);
});

test("registration counts use owner and exclusive creation bounds independently of status history", async () => {
  const { service, registrations } = fixture(null);
  registrations.push(
    { userId: "alice", createdAt: new Date("2026-09-01T03:00:00Z") },
    { userId: "alice", createdAt: new Date("2026-10-01T02:59:59.999Z") },
    { userId: "alice", createdAt: new Date("2026-10-01T03:00:00Z") },
    { userId: "alice", createdAt: new Date("2026-11-01T03:00:00Z") },
    { userId: "bob", createdAt: new Date("2026-10-01T03:00:00Z") },
  );
  const result = await service.getByUser("alice", "2026-10", now);
  assert.equal(result.metrics.registered.current, 1);
  assert.equal(result.metrics.registered.previous, 2);
  assert.equal(result.metrics.registered.percentageChange, -50);
  assert.equal(result.metrics.proposals.current, null);
  assert.equal(result.coverage.selected, "unknown");
});

test("stage aggregates are mapped per month with exact absolute and percentage comparisons", async () => {
  const { service, events } = fixture();
  events.push(
    { status: "PROPOSTA_ENVIADA", total: 5, current: 5, previous: 2 },
    { status: "GANHO", total: 2, current: 2, previous: 4 },
    { status: "PERDIDO", total: 1, current: 1, previous: 0 },
  );
  const { metrics } = await service.getByUser("alice", "2026-10", now);
  assert.equal(metrics.proposals.current, 5);
  assert.equal(metrics.proposals.difference, 3);
  assert.equal(metrics.proposals.percentageChange, 150);
  assert.equal(metrics.won.percentageChange, -50);
  assert.equal(metrics.lost.comparison, "no-base");
});

test("months before installation are unavailable, installation month is partial, later months are covered", async () => {
  const { service, events } = fixture(new Date("2026-10-22T15:00:00Z"));
  events.push({ status: "GANHO", total: 2, current: 2, previous: 0 });
  const old = await service.getByUser("alice", "2026-09", now);
  assert.equal(old.coverage.selected, "unavailable");
  assert.equal(old.metrics.won.current, null);
  const installation = await service.getByUser("alice", "2026-10", now);
  assert.equal(installation.coverage.selected, "partial");
  assert.equal(installation.metrics.won.current, 2);
  assert.equal(installation.metrics.won.comparison, "unavailable");
  assert.equal(installation.metrics.won.difference, null);
  const next = await service.getByUser("alice", "2026-11", now);
  assert.equal(next.coverage.selected, "complete");
  assert.equal(next.coverage.previous, "unavailable");
  assert.equal(next.metrics.won.previous, null);
  assert.equal(next.metrics.won.comparison, "unavailable");
});

test("current month totals include today but all deltas use the equivalent completed days only", async () => {
  const { service, registrations, events, counts } = fixture();
  registrations.push(
    ...[
      "2026-09-01T03:00:00Z",
      "2026-09-22T03:00:00Z",
      "2026-09-30T14:00:00Z",
      "2026-10-01T03:00:00Z",
      "2026-10-22T02:59:59.999Z",
      "2026-10-22T03:00:00Z",
      "2026-10-23T03:00:00Z",
    ].map((createdAt) => ({ userId: "alice", createdAt: new Date(createdAt) })),
  );
  registrations.push({
    userId: "bob",
    createdAt: new Date("2026-10-10T03:00:00Z"),
  });
  events.push({ status: "GANHO", total: 5, current: 3, previous: 2 });
  const result = await service.getByUser(
    "alice",
    "2026-10",
    new Date("2026-10-22T15:30:00Z"),
  );
  assert.equal(counts.length, 3);
  assert.deepEqual(result.metrics.registered, {
    current: 3,
    comparisonCurrent: 2,
    previous: 1,
    difference: 1,
    percentageChange: 100,
    comparison: "comparable",
  });
  assert.deepEqual(result.metrics.won, {
    current: 5,
    comparisonCurrent: 3,
    previous: 2,
    difference: 1,
    percentageChange: 50,
    comparison: "comparable",
  });
});

test("month length clamping excludes extra completed current days from the delta but preserves their total", async () => {
  const { service, registrations } = fixture();
  registrations.push(
    ...[
      "2027-02-28T15:00:00Z",
      "2027-03-28T15:00:00Z",
      "2027-03-29T03:00:00Z",
      "2027-03-30T15:00:00Z",
    ].map((createdAt) => ({ userId: "alice", createdAt: new Date(createdAt) })),
  );
  const { metrics } = await service.getByUser(
    "alice",
    "2027-03",
    new Date("2027-03-31T15:00:00Z"),
  );
  assert.equal(metrics.registered.current, 3);
  assert.equal(metrics.registered.comparisonCurrent, 1);
  assert.equal(metrics.registered.previous, 1);
  assert.equal(metrics.registered.difference, 0);
  assert.equal(metrics.registered.percentageChange, 0);
});

test("first local day keeps totals and leaves comparison unavailable rather than implying zero activity", async () => {
  const { service, registrations, events, counts } = fixture();
  registrations.push({
    userId: "alice",
    createdAt: new Date("2026-11-01T03:00:00Z"),
  });
  events.push({ status: "GANHO", total: 2, current: 0, previous: 0 });
  const result = await service.getByUser(
    "alice",
    undefined,
    new Date("2026-11-01T14:00:00Z"),
  );
  assert.equal(result.comparisonPeriod.available, false);
  assert.equal(counts.length, 1);
  assert.equal(result.metrics.registered.current, 1);
  assert.equal(result.metrics.won.current, 2);
  for (const metric of Object.values(result.metrics)) {
    assert.equal(metric.comparisonCurrent, null);
    assert.equal(metric.previous, null);
    assert.equal(metric.difference, null);
    assert.equal(metric.percentageChange, null);
    assert.equal(metric.comparison, "unavailable");
  }
});

test("coverage is checked over each actual comparison window, including a start later today", async () => {
  const { service, events } = fixture(new Date("2026-10-22T14:00:00Z"));
  events.push({ status: "GANHO", total: 2, current: 0, previous: 0 });
  const result = await service.getByUser(
    "alice",
    "2026-10",
    new Date("2026-10-22T15:30:00Z"),
  );
  assert.equal(result.coverage.selected, "partial");
  assert.equal(result.coverage.comparisonSelected, "unavailable");
  assert.equal(result.metrics.won.current, 2);
  assert.equal(result.metrics.won.comparisonCurrent, null);
  assert.equal(result.metrics.won.comparison, "unavailable");
});

test("a partially covered previous equivalent period exposes its recorded count but never a delta", async () => {
  const { service, events } = fixture(new Date("2026-09-15T14:00:00Z"));
  events.push({ status: "GANHO", total: 10, current: 8, previous: 2 });
  const result = await service.getByUser(
    "alice",
    "2026-10",
    new Date("2026-10-22T15:30:00Z"),
  );
  assert.equal(result.coverage.comparisonSelected, "complete");
  assert.equal(result.coverage.previous, "partial");
  assert.equal(result.metrics.won.comparisonCurrent, 8);
  assert.equal(result.metrics.won.previous, 2);
  assert.equal(result.metrics.won.difference, null);
  assert.equal(result.metrics.won.percentageChange, null);
});

test("unauthenticated calls never issue an unscoped query", async () => {
  const { service, calls, counts } = fixture();
  await assert.rejects(
    service.getByUser(" ", "2026-10", now),
    /não autenticado/,
  );
  assert.deepEqual(calls, []);
  assert.deepEqual(counts, []);
});
