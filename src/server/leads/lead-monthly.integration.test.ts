import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import type { LeadStatus } from "../../../generated/prisma/enums";
import { LeadMonthlyService } from "./lead-monthly.service";
import { LeadFunnelService } from "./lead-funnel.service";

test(
  "PostgreSQL monthly aggregates deduplicate leads per stage/month, honor local boundaries, isolate owners and leave current funnel independent",
  {
    skip:
      process.env.LEAD_MONTHLY_DATABASE_TEST !== "1"
        ? "Set LEAD_MONTHLY_DATABASE_TEST=1 with a migrated PostgreSQL database."
        : false,
  },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const users = [randomUUID(), randomUUID()];
    const categoryId = randomUUID();
    const now = new Date("2027-02-15T15:00:00Z");
    try {
      await db.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Monthly disposable test",
          email: `monthly-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Monthly test ${categoryId}` },
      });
      const service = new LeadMonthlyService(db);
      const empty = await service.getByUser(users[0], "2027-01", now);
      assert.equal(empty.metrics.registered.current, 0);
      assert.equal(empty.metrics.won.current, 0);
      const dates = [
        "2026-12-01T03:00:00Z",
        "2027-01-01T02:59:59.999Z",
        "2027-01-01T03:00:00Z",
        "2027-02-01T02:59:59.999Z",
        "2027-02-01T03:00:00Z",
      ];
      const leads = [];
      for (const createdAt of dates)
        leads.push(
          await db.lead.create({
            data: {
              userId: users[0],
              categoryId,
              source: "MANUAL",
              name: "Disposable monthly lead",
              createdAt: new Date(createdAt),
            },
          }),
        );
      const foreign = await db.lead.create({
        data: {
          userId: users[1],
          categoryId,
          source: "MANUAL",
          name: "Other owner",
          createdAt: new Date(dates[2]),
        },
      });
      const revisions = new Map<
        string,
        { revision: number; status: LeadStatus }
      >();
      async function event(
        leadId: string,
        toStatus: LeadStatus,
        occurredAt: string,
      ) {
        const previous = revisions.get(leadId) ?? {
          revision: 0,
          status: "NOVO" as LeadStatus,
        };
        await db.leadStatusHistory.create({
          data: {
            leadId,
            revision: previous.revision + 1,
            fromStatus: previous.status,
            toStatus,
            occurredAt: new Date(occurredAt),
          },
        });
        revisions.set(leadId, {
          revision: previous.revision + 1,
          status: toStatus,
        });
      }
      await event(leads[0].id, "PROPOSTA_ENVIADA", "2026-12-01T03:00:00Z");
      await event(leads[0].id, "NOVO", "2027-01-01T02:59:59.999Z");
      await event(leads[0].id, "PROPOSTA_ENVIADA", "2027-01-01T03:00:00Z");
      await event(leads[0].id, "NOVO", "2027-01-10T15:00:00Z");
      await event(leads[0].id, "PROPOSTA_ENVIADA", "2027-01-11T15:00:00Z");
      await event(leads[0].id, "GANHO", "2027-01-12T15:00:00Z");
      await event(leads[0].id, "PERDIDO", "2027-01-13T15:00:00Z");
      await event(leads[2].id, "GANHO", "2027-02-01T02:59:59.999Z");
      await event(leads[3].id, "GANHO", "2027-02-01T03:00:00Z");
      await event(foreign.id, "PROPOSTA_ENVIADA", "2027-01-15T15:00:00Z");
      await event(foreign.id, "GANHO", "2027-01-16T15:00:00Z");
      const result = await service.getByUser(users[0], "2027-01", now);
      assert.deepEqual(
        [result.metrics.registered.current, result.metrics.registered.previous],
        [2, 2],
      );
      assert.deepEqual(
        [result.metrics.proposals.current, result.metrics.proposals.previous],
        [1, 1],
      );
      assert.deepEqual(
        [result.metrics.won.current, result.metrics.won.previous],
        [2, 0],
      );
      assert.deepEqual(
        [result.metrics.lost.current, result.metrics.lost.previous],
        [1, 0],
      );
      assert.equal(
        (await service.getByUser(users[1], "2027-01", now)).metrics.won.current,
        1,
      );
      assert.equal(
        (await new LeadFunnelService(db).getByUser(users[0])).counts.NOVO,
        5,
      );
      await event(leads[1].id, "GANHO", "2027-01-20T15:00:00Z");
      assert.equal(
        (await service.getByUser(users[0], "2027-01", now)).metrics.won.current,
        3,
      );
      const old = await service.getByUser(users[0], "2025-01", now);
      assert.equal(old.metrics.won.current, null);
      assert.equal(old.metrics.registered.current, 0);

      // January 13: totals include today; comparison uses January/December 1–12.
      const todayLead = await db.lead.create({
        data: {
          userId: users[0],
          categoryId,
          source: "MANUAL",
          name: "Today's disposable lead",
          createdAt: new Date("2027-01-13T03:00:00Z"),
        },
      });
      await event(todayLead.id, "GANHO", "2027-01-13T04:00:00Z");
      await event(todayLead.id, "NOVO", "2027-01-13T05:00:00Z");
      await event(todayLead.id, "GANHO", "2027-01-13T06:00:00Z");
      const latePrevious = await db.lead.create({
        data: {
          userId: users[0],
          categoryId,
          source: "MANUAL",
          name: "Outside equivalent previous period",
          createdAt: new Date("2026-12-13T03:00:00Z"),
        },
      });
      await event(latePrevious.id, "GANHO", "2026-12-13T04:00:00Z");
      const current = await service.getByUser(
        users[0],
        "2027-01",
        new Date("2027-01-13T16:00:00Z"),
      );
      assert.deepEqual(current.metrics.registered, {
        current: 2,
        comparisonCurrent: 1,
        previous: 1,
        difference: 0,
        percentageChange: 0,
        comparison: "stable",
      });
      assert.deepEqual(current.metrics.won, {
        current: 2,
        comparisonCurrent: 1,
        previous: 0,
        difference: 1,
        percentageChange: null,
        comparison: "no-base",
      });
      assert.equal(current.metrics.proposals.current, 1);
      assert.equal(current.metrics.proposals.comparisonCurrent, 1);
      assert.equal(current.metrics.proposals.previous, 1);
      assert.equal(current.metrics.lost.current, 1);
      assert.equal(current.metrics.lost.comparisonCurrent, 0);
      assert.equal(current.metrics.lost.difference, 0);
    } finally {
      try {
        await db.user.deleteMany({ where: { id: { in: users } } });
        await db.category.deleteMany({ where: { id: categoryId } });
      } finally {
        await db.$disconnect();
      }
    }
  },
);
