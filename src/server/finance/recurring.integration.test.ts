import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../../generated/prisma/client";
import { RecurringService } from "./recurring.service";
import { FinanceService } from "./finance.service";
import { recurringFixture } from "./recurring-test-fixture";

test(
  "PostgreSQL recurring contracts integrate with immutable receivables and receipts",
  { skip: process.env.FINANCE_DATABASE_TEST !== "1", timeout: 120000 },
  async (t) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const fixture = await recurringFixture(db);
    const [user, other] = fixture.users;
    let now = new Date("2026-01-15T15:00:00Z");
    const service = new RecurringService(db, () => now),
      finance = new FinanceService(db);
    const terms = {
      kind: "AMBOS",
      description: "Hospedagem e manutenção",
      monthlyAmount: "100.01",
      dueDay: 31,
      paymentMethod: "PIX",
      notes: "Condições iniciais",
    };
    const payload = {
      id: randomUUID(),
      saleId: fixture.sale.id,
      startsOn: "2026-01-10",
      terms,
    };
    const cmd = (revision: number) => ({
      id: payload.id,
      expectedRevision: revision,
    });
    try {
      await t.test(
        "creation is authorized, atomic and idempotent under concurrent retry",
        async () => {
          await assert.rejects(service.create(payload, other), {
            code: "NOT_FOUND",
          });
          const broken = new RecurringService(
            {
              $transaction: (
                fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
              ) =>
                db.$transaction(async (tx) => {
                  await fn(tx);
                  throw new Error("injected");
                }),
            } as unknown as PrismaClient,
            () => now,
          );
          await assert.rejects(broken.create(payload, user));
          assert.equal(
            await db.recurringContract.count({ where: { id: payload.id } }),
            0,
          );
          await Promise.all([
            service.create(payload, user),
            service.create(payload, user),
          ]);
          const row = await service.get(payload.id, user);
          assert.equal(row.status, "ATIVO");
          assert.equal(row.history.length, 1);
          assert.equal(row.receivables.length, 0);
          await assert.rejects(
            service.create(
              { ...payload, terms: { ...terms, monthlyAmount: "5" } },
              user,
            ),
            { code: "CONFLICT" },
          );
        },
      );
      await t.test(
        "same contract and competence create a single unpaid account even under races",
        async () => {
          await Promise.all([
            service.generate({ ...cmd(0), competence: "2026-01" }, user),
            service.generate({ ...cmd(0), competence: "2026-01" }, user),
          ]);
          const row = await service.get(payload.id, user);
          assert.equal(row.receivables.length, 1);
          assert.equal(row.receivables[0].amount, "100.01");
          assert.equal(row.receivables[0].status, "Pendente");
          assert.equal(row.receivables[0].dueOn, "2026-01-31");
          await assert.rejects(
            service.generate({ ...cmd(0), competence: "2026-02" }, user),
            { code: "INVALID" },
          );
          await assert.rejects(
            service.generate({ ...cmd(0), competence: "2025-12" }, user),
            { code: "INVALID" },
          );
          await assert.rejects(
            db.receivable.create({
              data: {
                saleId: fixture.sale.id,
                contractId: payload.id,
                competence: new Date("2026-01-01"),
                description: "Duplicada",
                amount: "1",
                dueOn: new Date("2026-01-31"),
                paymentMethod: "PIX",
              },
            }),
            { code: "P2002" },
          );
        },
      );
      await t.test(
        "editing preserves generated charges and uses historical terms for older ungenerated periods",
        async () => {
          now = new Date("2026-03-05T15:00:00Z");
          await service.update(
            {
              ...cmd(0),
              terms: {
                ...terms,
                monthlyAmount: "150",
                description: "Novo suporte",
              },
            },
            user,
          );
          await service.generate({ ...cmd(1), competence: "2026-02" }, user);
          await service.generate({ ...cmd(1), competence: "2026-03" }, user);
          const row = await service.get(payload.id, user);
          assert.deepEqual(
            row.receivables.map((r) => [r.competence, r.amount, r.dueOn]),
            [
              ["2026-03", "150.00", "2026-03-31"],
              ["2026-02", "100.01", "2026-02-28"],
              ["2026-01", "100.01", "2026-01-31"],
            ],
          );
          assert.equal(row.history[1].conditions.monthlyAmount, "100.01");
          await assert.rejects(service.update({ ...cmd(0), terms }, user), {
            code: "CONFLICT",
          });
        },
      );
      await t.test(
        "suspension blocks current and subsequent competencies while retaining earlier charges",
        async () => {
          now = new Date("2026-04-10T15:00:00Z");
          await service.changeStatus(
            { ...cmd(1), status: "SUSPENSO", reason: "Pausa solicitada" },
            user,
          );
          await assert.rejects(
            service.generate({ ...cmd(2), competence: "2026-04" }, user),
            { code: "INVALID" },
          );
          now = new Date("2026-05-05T15:00:00Z");
          await assert.rejects(
            service.generate({ ...cmd(2), competence: "2026-05" }, user),
            { code: "INVALID" },
          );
          assert.equal(
            (await service.get(payload.id, user)).receivables.length,
            3,
          );
          await service.changeStatus(
            { ...cmd(2), status: "SUSPENSO", reason: "Sem alteração" },
            user,
          );
          assert.equal((await service.get(payload.id, user)).history.length, 3);
        },
      );
      await t.test(
        "reactivation resumes current month, preserves suspended gap and cancellation is terminal",
        async () => {
          now = new Date("2026-06-05T15:00:00Z");
          await service.changeStatus(
            { ...cmd(2), status: "ATIVO", reason: "Retomada acordada" },
            user,
          );
          await service.generate({ ...cmd(3), competence: "2026-06" }, user);
          await assert.rejects(
            service.generate({ ...cmd(3), competence: "2026-05" }, user),
            { code: "INVALID" },
          );
          now = new Date("2026-07-01T15:00:00Z");
          await service.changeStatus(
            {
              ...cmd(3),
              status: "CANCELADO",
              reason: "Encerramento solicitado",
            },
            user,
          );
          await assert.rejects(
            service.generate({ ...cmd(4), competence: "2026-07" }, user),
            { code: "INVALID" },
          );
          await assert.rejects(
            service.changeStatus(
              { ...cmd(4), status: "ATIVO", reason: "Nova contratação" },
              user,
            ),
            { code: "INVALID" },
          );
          await assert.rejects(service.update({ ...cmd(4), terms }, user), {
            code: "INVALID",
          });
          // An existing account can always be retrieved by an idempotent retry.
          await service.generate({ ...cmd(0), competence: "2026-06" }, user);
        },
      );
      const account = (await service.get(payload.id, user)).receivables.find(
        (r) => r.competence === "2026-01",
      )!;
      const payment = {
        id: randomUUID(),
        receivableId: account.id,
        amount: "40",
        receivedOn: "2026-01-20",
        paymentMethod: "PIX",
        notes: "Parcial",
      };
      await t.test(
        "partial and full payments reuse existing rules, reject overpayment and preserve reversals",
        async () => {
          await Promise.all([
            finance.receive(payment, user),
            finance.receive(payment, user),
          ]);
          let row = (await service.get(payload.id, user)).receivables.find(
            (r) => r.id === account.id,
          )!;
          assert.equal(row.received, "40.00");
          assert.equal(row.status, "Parcialmente recebido");
          assert.equal(row.overdue, true);
          const results = await Promise.allSettled(
            [1, 2].map(() =>
              finance.receive(
                { ...payment, id: randomUUID(), amount: "60.01" },
                user,
              ),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          row = (await service.get(payload.id, user)).receivables.find(
            (r) => r.id === account.id,
          )!;
          assert.equal(row.status, "Recebido");
          assert.equal(row.outstanding, "0.00");
          assert.equal(row.overdue, false);
          await finance.reverse(
            { receiptId: payment.id, reason: "Valor a corrigir" },
            user,
          );
          row = (await service.get(payload.id, user)).receivables.find(
            (r) => r.id === account.id,
          )!;
          assert.equal(row.outstanding, "40.00");
          assert.equal(row.receipts.length, 2);
          assert.equal(row.receipts.filter((r) => r.reversal).length, 1);
          const listed = await service.list(user, {
            search: "recorrente",
            status: "CANCELADO",
          });
          assert.equal(listed.count, 1);
          assert.equal(listed.rows[0].outstanding, "440.01");
          assert.equal(listed.rows[0].overdue, "440.01");
        },
      );
      await t.test(
        "recurring payments do not change development sale balances or dashboard sales",
        async () => {
          const overview = await finance.overview(user, "accounts");
          assert.equal(overview.sold, "1000.00");
          assert.equal(overview.received, "0.00");
          assert.equal(overview.outstanding, "1000.00");
          assert.equal(overview.accounts[0].accounts.length, 1);
          assert.equal(
            (await finance.get(fixture.sale.id, user)).receivables.length,
            1,
          );
          assert.equal((await finance.overview(user, "receipts")).count, 0);
        },
      );
      await t.test(
        "foreign users cannot read, edit, generate, receive or reverse; filters stay scoped",
        async () => {
          for (const run of [
            () => service.get(payload.id, other),
            () => service.update({ ...cmd(4), terms }, other),
            () => service.generate({ ...cmd(4), competence: "2026-01" }, other),
            () =>
              service.changeStatus(
                { ...cmd(4), status: "ATIVO", reason: "Teste" },
                other,
              ),
            () => finance.receive({ ...payment, id: randomUUID() }, other),
            () =>
              finance.reverse(
                { receiptId: payment.id, reason: "Teste" },
                other,
              ),
          ])
            await assert.rejects(run, { code: "NOT_FOUND" });
          assert.equal((await service.list(other)).count, 0);
          assert.equal(
            (await service.list(user, { status: "ATIVO" })).count,
            0,
          );
          assert.equal(
            (await service.list(user, { search: "inexistente" })).count,
            0,
          );
        },
      );
      await t.test(
        "history and generated monthly amounts cannot be rewritten in PostgreSQL",
        async () => {
          const row = await service.get(payload.id, user);
          await assert.rejects(
            db.recurringContractHistory.update({
              where: { id: row.history[0].id },
              data: { reason: "Reescrever" },
            }),
          );
          await assert.rejects(
            db.receivable.update({
              where: { id: account.id },
              data: { amount: "1" },
            }),
          );
          assert.deepEqual(
            row.history.map((h) => h.revision),
            [4, 3, 2, 1, 0],
          );
        },
      );
      await t.test(
        "concurrent state changes keep one consistent revision and history event",
        async () => {
          const id = randomUUID();
          await service.create({ ...payload, id }, user);
          const results = await Promise.allSettled(
            ["SUSPENSO", "CANCELADO"].map((status) =>
              service.changeStatus(
                { id, expectedRevision: 0, status, reason: "Concorrência" },
                user,
              ),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const row = await service.get(id, user);
          assert.equal(row.revision, 1);
          assert.equal(row.history.length, 2);
          assert.equal(row.status, row.history[0].toStatus);
        },
      );
      await t.test(
        "failed condition changes roll back both contract and history",
        async () => {
          const id = randomUUID();
          await service.create({ ...payload, id }, user);
          const broken = new RecurringService(
            {
              $transaction: (
                fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
              ) =>
                db.$transaction(async (tx) => {
                  await fn(tx);
                  throw new Error("injected");
                }),
            } as unknown as PrismaClient,
            () => now,
          );
          await assert.rejects(
            broken.update(
              {
                id,
                expectedRevision: 0,
                terms: { ...terms, monthlyAmount: "999" },
              },
              user,
            ),
          );
          const row = await service.get(id, user);
          assert.equal(row.monthlyAmount, "100.01");
          assert.equal(row.history.length, 1);
        },
      );
    } finally {
      await fixture.cleanup();
      await db.$disconnect();
    }
  },
);
