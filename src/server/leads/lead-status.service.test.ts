import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "../../../generated/prisma/client";
import type { LeadStatus } from "../../../generated/prisma/enums";
import { LeadStatusService } from "./lead-status.service";
import { changeLeadStatusSchema } from "./lead-status.schema";

function fixture(status: LeadStatus = "NOVO") {
  const userId = randomUUID();
  const leadId = randomUUID();
  let lead = { id: leadId, userId, status, statusRevision: 0 };
  type Entry = {
    id: string;
    leadId: string;
    fromStatus: LeadStatus;
    toStatus: LeadStatus;
    revision: number;
    occurredAt: Date;
    recordedAt: Date;
  };
  let entries: Entry[] = [];
  let failHistory = false;
  const matches = (where: Record<string, unknown>) =>
    Object.entries(where).every(
      ([key, value]) => lead[key as keyof typeof lead] === value,
    );
  const delegate = {
    lead: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        matches(where) ? { ...lead } : null,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: { status: LeadStatus };
      }) => {
        if (!matches(where)) return { count: 0 };
        lead = {
          ...lead,
          status: data.status,
          statusRevision: lead.statusRevision + 1,
        };
        return { count: 1 };
      },
    },
    leadStatusHistory: {
      create: async ({ data }: { data: Omit<Entry, "id"> }) => {
        if (failHistory) throw new Error("History insert failed");
        const entry = { id: randomUUID(), ...data };
        entries.push(entry);
        return entry;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { leadId: string; lead: { userId: string } };
        orderBy: unknown;
      }) => {
        assert.deepEqual(orderBy, [
          { occurredAt: "desc" },
          { revision: "desc" },
        ]);
        return entries
          .filter(
            (entry) =>
              entry.leadId === where.leadId &&
              lead.userId === where.lead.userId,
          )
          .sort(
            (a, b) =>
              b.occurredAt.getTime() - a.occurredAt.getTime() ||
              b.revision - a.revision,
          );
      },
    },
  };
  let queue = Promise.resolve();
  const db = {
    ...delegate,
    $transaction: (fn: (tx: typeof delegate) => Promise<unknown>) => {
      const execute = async () => {
        const previousLead = { ...lead };
        const previousEntries = [...entries];
        try {
          return await fn(delegate);
        } catch (error) {
          lead = previousLead;
          entries = previousEntries;
          throw error;
        }
      };
      const result = queue.then(execute);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  } as unknown as PrismaClient;
  return {
    service: new LeadStatusService(db),
    userId,
    leadId,
    input: (next: LeadStatus, expectedRevision = 0) => ({
      leadId,
      status: next,
      expectedRevision,
    }),
    lead: () => lead,
    entries: () => entries,
    failHistory: () => {
      failHistory = true;
    },
  };
}

test("a valid change stores the actual previous status, new status and server timestamps", async () => {
  const f = fixture();
  const before = Date.now();
  const result = await f.service.change(f.input("PROPOSTA_ENVIADA"), f.userId);
  assert.deepEqual(result, {
    changed: true,
    status: "PROPOSTA_ENVIADA",
    statusRevision: 1,
  });
  const entry = f.entries()[0];
  assert.equal(entry.fromStatus, "NOVO");
  assert.equal(entry.toStatus, "PROPOSTA_ENVIADA");
  assert.equal(entry.revision, 1);
  assert.ok(
    entry.occurredAt.getTime() >= before &&
      entry.occurredAt.getTime() <= Date.now(),
  );
  assert.equal(entry.recordedAt.getTime(), entry.occurredAt.getTime());
});

test("changing to the same status leaves revision and history untouched", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.change(f.input("NOVO"), f.userId), {
    changed: false,
    status: "NOVO",
    statusRevision: 0,
  });
  assert.equal(f.entries().length, 0);
  assert.equal(f.lead().statusRevision, 0);
});

test("a failed history write rolls back the status and revision", async () => {
  const f = fixture();
  f.failHistory();
  await assert.rejects(
    f.service.change(f.input("GANHO"), f.userId),
    /History insert failed/,
  );
  assert.equal(f.lead().status, "NOVO");
  assert.equal(f.lead().statusRevision, 0);
  assert.equal(f.entries().length, 0);
});

test("authorization protects changes and history, including missing leads", async () => {
  const f = fixture();
  await assert.rejects(f.service.change(f.input("GANHO"), randomUUID()), {
    code: "NOT_FOUND",
  });
  await assert.rejects(f.service.history(f.leadId, randomUUID()), {
    code: "NOT_FOUND",
  });
  await assert.rejects(f.service.history(randomUUID(), f.userId), {
    code: "NOT_FOUND",
  });
  await assert.rejects(f.service.change(f.input("GANHO"), ""), {
    code: "UNAUTHENTICATED",
  });
  assert.equal(f.entries().length, 0);
});

test("concurrent submissions cannot overwrite one another or duplicate a transition", async () => {
  const f = fixture();
  const result = await Promise.allSettled([
    f.service.change(f.input("GANHO"), f.userId),
    f.service.change(f.input("PERDIDO"), f.userId),
  ]);
  assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    (result.find((item) => item.status === "rejected") as PromiseRejectedResult)
      .reason.code,
    "CONFLICT",
  );
  assert.equal(f.entries().length, 1);
});

test("won and lost leads can reopen, and returning to an earlier status does not permit stale updates", async () => {
  for (const initial of ["GANHO", "PERDIDO"] as const) {
    const f = fixture(initial);
    await f.service.change(f.input("NOVO"), f.userId);
    await f.service.change(f.input(initial, 1), f.userId);
    await assert.rejects(f.service.change(f.input("NOVO", 0), f.userId), {
      code: "CONFLICT",
    });
    assert.deepEqual(
      f.entries().map((entry) => [entry.fromStatus, entry.toStatus]),
      [
        [initial, "NOVO"],
        ["NOVO", initial],
      ],
    );
  }
});

test("legacy leads have no invented history, and changes are returned newest first", async () => {
  const f = fixture("GANHO");
  assert.deepEqual(await f.service.history(f.leadId, f.userId), []);
  await f.service.change(f.input("NOVO"), f.userId);
  await f.service.change(f.input("PERDIDO", 1), f.userId);
  assert.deepEqual(
    (await f.service.history(f.leadId, f.userId)).map(
      (entry) => entry.revision,
    ),
    [2, 1],
  );
});

test("schema rejects invented statuses, invalid revisions and client supplied actors or dates", () => {
  const input = { leadId: randomUUID(), status: "GANHO", expectedRevision: 0 };
  assert.ok(changeLeadStatusSchema.safeParse(input).success);
  for (const value of [
    { ...input, status: "NEGOCIACAO" },
    { ...input, expectedRevision: -1 },
    { ...input, expectedRevision: 0.5 },
    { ...input, expectedRevision: Infinity },
    { ...input, occurredAt: new Date().toISOString() },
    { ...input, userId: randomUUID() },
  ])
    assert.equal(changeLeadStatusSchema.safeParse(value).success, false);
});
