import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import type { Prisma } from "../../../generated/prisma/client";
import { LeadStatusService } from "./lead-status.service";
import { LeadFunnelService } from "./lead-funnel.service";

test(
  "PostgreSQL status transitions: isolation, concurrent revisions, rollback, reopening and current funnel",
  {
    skip:
      process.env.LEAD_STATUS_DATABASE_TEST !== "1"
        ? "Set LEAD_STATUS_DATABASE_TEST=1 with a migrated test database."
        : false,
  },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const users = [randomUUID(), randomUUID()];
    const categoryId = randomUUID();
    try {
      await db.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Status test",
          email: `status-test-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Status test ${categoryId}` },
      });
      const lead = await db.lead.create({
        data: {
          userId: users[0],
          categoryId,
          name: "Disposable status test",
          source: "MANUAL",
          status: "GANHO",
        },
      });
      const service = new LeadStatusService(db);
      const input = { leadId: lead.id, status: "NOVO", expectedRevision: 0 };
      assert.equal(lead.statusRevision, 0);
      assert.deepEqual(await service.history(lead.id, users[0]), []);
      await assert.rejects(service.change(input, users[1]), {
        code: "NOT_FOUND",
      });
      await assert.rejects(service.history(lead.id, users[1]), {
        code: "NOT_FOUND",
      });
      await assert.rejects(
        service.change({ ...input, status: "INVALID" }, users[0]),
      );

      const same = await service.change(
        { ...input, status: "GANHO" },
        users[0],
      );
      assert.equal(same.changed, false);
      assert.equal((await service.history(lead.id, users[0])).length, 0);
      const concurrent = await Promise.allSettled([
        service.change(input, users[0]),
        service.change({ ...input, status: "PERDIDO" }, users[0]),
      ]);
      assert.equal(
        concurrent.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        (
          concurrent.find(
            (result) => result.status === "rejected",
          ) as PromiseRejectedResult
        ).reason.code,
        "CONFLICT",
      );
      const history = await service.history(lead.id, users[0]);
      assert.equal(history.length, 1);
      assert.equal(history[0].fromStatus, "GANHO");
      let current = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      assert.equal(current.statusRevision, 1);
      assert.equal(current.status, history[0].toStatus);

      // Force the history write to violate a real DB constraint AFTER the lead update.
      const broken = new LeadStatusService({
        $transaction: (
          fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) =>
          db.$transaction((tx) =>
            fn(
              new Proxy(tx, {
                get(target, key) {
                  if (key !== "leadStatusHistory")
                    return Reflect.get(target, key);
                  return {
                    create: ({
                      data,
                    }: {
                      data: Prisma.LeadStatusHistoryUncheckedCreateInput;
                    }) =>
                      tx.leadStatusHistory.create({
                        data: { ...data, revision: 0 },
                      }),
                  };
                },
              }),
            ),
          ),
      } as unknown as PrismaClient);
      const next = current.status === "NOVO" ? "PERDIDO" : "NOVO";
      await assert.rejects(
        broken.change(
          { ...input, status: next, expectedRevision: 1 },
          users[0],
        ),
      );
      assert.deepEqual(
        await db.lead.findUniqueOrThrow({ where: { id: lead.id } }),
        current,
      );
      assert.equal((await service.history(lead.id, users[0])).length, 1);

      for (const status of [
        "PERDIDO",
        "NOVO",
        "GANHO",
        "NOVO",
        "GANHO",
      ] as const) {
        await service.change(
          { leadId: lead.id, status, expectedRevision: current.statusRevision },
          users[0],
        );
        current = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      }
      await assert.rejects(service.change(input, users[0]), {
        code: "CONFLICT",
      });
      const entries = await service.history(lead.id, users[0]);
      assert.equal(entries.length, current.statusRevision);
      assert.deepEqual(
        entries.map((entry) => entry.revision),
        Array.from(
          { length: entries.length },
          (_, index) => entries.length - index,
        ),
      );
      const chronological = [...entries].reverse();
      for (let i = 1; i < chronological.length; i++)
        assert.equal(
          chronological[i].fromStatus,
          chronological[i - 1].toStatus,
        );
      await assert.rejects(
        db.leadStatusHistory.update({
          where: { id: entries[0].id },
          data: { toStatus: "NOVO" },
        }),
      );
      const funnel = new LeadFunnelService(db);
      assert.deepEqual(await funnel.getByUser(users[0]), {
        total: 1,
        counts: { NOVO: 0, PROPOSTA_ENVIADA: 0, GANHO: 1, PERDIDO: 0 },
        conversionRate: 100,
      });
      assert.equal((await funnel.getByUser(users[1])).total, 0);
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
