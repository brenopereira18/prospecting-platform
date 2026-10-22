import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../lib/prisma/client";
import type { PrismaClient } from "../../../generated/prisma/client";
import type { LeadStatus } from "../../../generated/prisma/enums";
import { LeadFunnelService } from "./lead-funnel.service";

function fixture() {
  const rows: { userId: string; status: LeadStatus }[] = [];
  const calls: unknown[] = [];
  const db = {
    lead: {
      groupBy: async (args: { where: { userId: string } }) => {
        calls.push(args);
        const counts = new Map<LeadStatus, number>();
        for (const row of rows.filter(
          (row) => row.userId === args.where.userId,
        ))
          counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return [...counts].map(([status, count]) => ({
          status,
          _count: { _all: count },
        }));
      },
    },
  } as unknown as Pick<PrismaClient, "lead">;
  return { rows, calls, service: new LeadFunnelService(db) };
}

test("empty funnel includes every persisted status and avoids division by zero", async () => {
  const { service } = fixture();
  assert.deepEqual(await service.getByUser("alice"), {
    total: 0,
    counts: { NOVO: 0, PROPOSTA_ENVIADA: 0, GANHO: 0, PERDIDO: 0 },
    conversionRate: 0,
  });
});

test("one aggregate query counts current statuses only for the requested user", async () => {
  const { service, rows, calls } = fixture();
  rows.push(
    { userId: "alice", status: "NOVO" },
    { userId: "alice", status: "NOVO" },
    { userId: "alice", status: "PROPOSTA_ENVIADA" },
    { userId: "alice", status: "GANHO" },
    { userId: "alice", status: "PERDIDO" },
    { userId: "bob", status: "GANHO" },
  );
  assert.deepEqual(await service.getByUser("alice"), {
    total: 5,
    counts: { NOVO: 2, PROPOSTA_ENVIADA: 1, GANHO: 1, PERDIDO: 1 },
    conversionRate: 20,
  });
  assert.deepEqual(calls, [
    { by: ["status"], where: { userId: "alice" }, _count: { _all: true } },
  ]);
  assert.equal((await service.getByUser("bob")).total, 1);
});

test("another read reflects a status change without cumulative or cached counts", async () => {
  const { service, rows } = fixture();
  rows.push({ userId: "alice", status: "PROPOSTA_ENVIADA" });
  assert.equal((await service.getByUser("alice")).counts.PROPOSTA_ENVIADA, 1);
  rows[0].status = "GANHO";
  const result = await service.getByUser("alice");
  assert.equal(result.total, 1);
  assert.equal(result.counts.PROPOSTA_ENVIADA, 0);
  assert.equal(result.counts.GANHO, 1);
  assert.equal(result.conversionRate, 100);
});

test("conversion uses all registered leads and preserves precision", async () => {
  const { service, rows } = fixture();
  rows.push(
    ...(["NOVO", "GANHO", "PERDIDO"] as const).map((status) => ({
      userId: "alice",
      status,
    })),
  );
  assert.ok(
    Math.abs((await service.getByUser("alice")).conversionRate - 100 / 3) <
      1e-10,
  );
});

test("an absent user identifier never runs an unscoped query", async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.getByUser(" "), /não autenticado/);
  assert.deepEqual(calls, []);
});

test(
  "PostgreSQL aggregates are isolated and reflect a persisted status update",
  {
    skip: process.env.LEAD_FUNNEL_DATABASE_TEST !== "1",
  },
  async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    const categoryId = randomUUID();
    try {
      await prisma.user.createMany({
        data: [alice, bob].map((id) => ({
          id,
          name: "Funnel integration test",
          email: `funnel-test-${id}@example.invalid`,
          passwordHash: "unused-test-fixture",
        })),
      });
      await prisma.category.create({
        data: { id: categoryId, name: `Funnel test ${categoryId}` },
      });
      const service = new LeadFunnelService(prisma);
      assert.equal((await service.getByUser(alice)).total, 0);
      await prisma.lead.createMany({
        data: [
          ...(
            ["NOVO", "NOVO", "PROPOSTA_ENVIADA", "GANHO", "PERDIDO"] as const
          ).map((status) => ({
            userId: alice,
            categoryId,
            source: "MANUAL" as const,
            name: "Test lead",
            status,
          })),
          {
            userId: bob,
            categoryId,
            source: "MANUAL",
            name: "Other user's test lead",
            status: "GANHO",
          },
        ],
      });
      assert.deepEqual(await service.getByUser(alice), {
        total: 5,
        counts: { NOVO: 2, PROPOSTA_ENVIADA: 1, GANHO: 1, PERDIDO: 1 },
        conversionRate: 20,
      });
      assert.equal((await service.getByUser(bob)).total, 1);
      await prisma.lead.updateMany({
        where: { userId: alice, status: "PROPOSTA_ENVIADA" },
        data: { status: "GANHO" },
      });
      const updated = await service.getByUser(alice);
      assert.equal(updated.total, 5);
      assert.equal(updated.counts.PROPOSTA_ENVIADA, 0);
      assert.equal(updated.counts.GANHO, 2);
      assert.equal(updated.conversionRate, 40);
    } finally {
      try {
        await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
        await prisma.category.deleteMany({ where: { id: categoryId } });
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
