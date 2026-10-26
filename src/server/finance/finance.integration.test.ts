import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../../generated/prisma/client";
import { FinanceService } from "./finance.service";
import { ProposalService } from "../proposals/proposal.service";
import { todayInSaoPaulo } from "./finance.schema";
test(
  "PostgreSQL finance: ownership, atomicity, exact balances, concurrent requests and history",
  { skip: process.env.FINANCE_DATABASE_TEST !== "1", timeout: 120000 },
  async (t) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const users = [randomUUID(), randomUUID()],
      categoryId = randomUUID();
    try {
      await db.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Finance test",
          email: `finance-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Finance ${categoryId}` },
      });
      const lead = await db.lead.create({
        data: {
          userId: users[0],
          categoryId,
          name: "Cliente original",
          source: "MANUAL",
        },
      });
      const ps = new ProposalService(db),
        service = new FinanceService(db),
        today = todayInSaoPaulo();
      const content = {
        title: "Site",
        description: "Desenvolvimento",
        scope: "Página",
        total: "1000.01",
        paymentMode: "DEFINIDAS",
        deposit: "100",
        depositMethod: "PIX",
        depositInstallments: 1,
        balanceMethod: "CARTAO",
        balanceInstallments: 3,
        deliveryDays: 10,
        validUntil: "2027-01-01",
        notes: "",
        managedHosting: true,
        monthlyAmount: "50",
        maintenance: "Suporte opcional",
      };
      let proposal = await ps.create(
        { id: randomUUID(), leadId: lead.id, content },
        users[0],
      );
      const payload = {
        id: randomUUID(),
        proposalId: proposal.id,
        leadId: lead.id,
        expectedProposalRevision: 0,
        soldOn: today,
        conditions: {
          total: "1000.01",
          deposit: "100",
          depositMethod: "PIX",
          depositInstallments: 1,
          balanceMethod: "CARTAO",
          balanceInstallments: 3,
          depositDueOn: today,
          balanceDueOn: today,
        },
      };
      await t.test(
        "a sale is never created automatically and requires won lead plus accepted proposal",
        async () => {
          await assert.rejects(service.createSale(payload, users[0]), {
            code: "INVALID",
          });
          proposal = await ps.changeStatus(
            {
              id: proposal.id,
              leadId: lead.id,
              expectedRevision: 0,
              status: "ENVIADA",
            },
            users[0],
          );
          proposal = await ps.changeStatus(
            {
              id: proposal.id,
              leadId: lead.id,
              expectedRevision: 1,
              status: "ACEITA",
            },
            users[0],
          );
          payload.expectedProposalRevision = 2;
          await assert.rejects(service.createSale(payload, users[0]), {
            code: "INVALID",
          });
          await db.lead.update({
            where: { id: lead.id },
            data: { status: "GANHO" },
          });
          assert.equal(await db.sale.count({ where: { userId: users[0] } }), 0);
        },
      );
      await t.test(
        "unauthorized and tampered conditions are rejected",
        async () => {
          await assert.rejects(service.createSale(payload, users[1]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(
            service.createSale(
              { ...payload, expectedProposalRevision: 0 },
              users[0],
            ),
            { code: "CONFLICT" },
          );
          await assert.rejects(
            service.createSale(
              {
                ...payload,
                conditions: { ...payload.conditions, total: "999" },
              },
              users[0],
            ),
            { code: "INVALID" },
          );
          await assert.rejects(
            service.createSale(
              {
                ...payload,
                conditions: { ...payload.conditions, balanceInstallments: 2 },
              },
              users[0],
            ),
            { code: "INVALID" },
          );
        },
      );
      await t.test(
        "failed transaction leaves neither a sale nor accounts",
        async () => {
          const broken = new FinanceService({
            $transaction: (
              fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
            ) =>
              db.$transaction(async (tx) => {
                await fn(tx);
                throw new Error("injected after write");
              }),
          } as unknown as PrismaClient);
          await assert.rejects(broken.createSale(payload, users[0]));
          assert.equal(
            await db.sale.count({ where: { proposalId: proposal.id } }),
            0,
          );
          assert.equal(
            await db.receivable.count({
              where: { sale: { userId: users[0] } },
            }),
            0,
          );
        },
      );
      await t.test(
        "simultaneous retries create one sale with exact accounts; different requests cannot duplicate",
        async () => {
          const results = await Promise.all([
            service.createSale(payload, users[0]),
            service.createSale(payload, users[0]),
          ]);
          assert.equal(results[0].saleId, results[1].saleId);
          await assert.rejects(
            service.createSale({ ...payload, id: randomUUID() }, users[0]),
            { code: "CONFLICT" },
          );
          const sale = await service.get(payload.id, users[0]);
          assert.equal(sale.total, "1000.01");
          assert.equal(sale.receivables.length, 4);
          assert.deepEqual(
            sale.receivables.map((a) => a.amount),
            ["100.00", "300.01", "300.00", "300.00"],
          );
          assert.ok(sale.receivables.every((a) => a.received === "0.00"));
        },
      );
      const sale = await service.get(payload.id, users[0]),
        account = sale.receivables[0];
      const payment = {
        id: randomUUID(),
        receivableId: account.id,
        amount: "40.00",
        receivedOn: today,
        paymentMethod: "PIX",
        notes: "Primeira parte",
      };
      await t.test(
        "partial receipts and retries preserve totals without duplicate credit",
        async () => {
          await Promise.all([
            service.receive(payment, users[0]),
            service.receive(payment, users[0]),
          ]);
          const current = (await service.get(sale.id, users[0])).receivables[0];
          assert.equal(current.received, "40.00");
          assert.equal(current.outstanding, "60.00");
          assert.equal(current.receipts.length, 1);
          assert.equal(current.status, "Parcialmente recebido");
          const summary = await service.overview(users[0]);
          assert.equal(summary.sold, "1000.01");
          assert.equal(summary.received, "40.00");
          assert.equal(summary.outstanding, "960.01");
          await assert.rejects(
            service.receive({ ...payment, amount: "41" }, users[0]),
            { code: "CONFLICT" },
          );
        },
      );
      await t.test(
        "simultaneous final payments cannot overdraw a receivable",
        async () => {
          const results = await Promise.allSettled(
            [1, 2].map(() =>
              service.receive(
                { ...payment, id: randomUUID(), amount: "60.00" },
                users[0],
              ),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const current = (await service.get(sale.id, users[0])).receivables[0];
          assert.equal(current.status, "Recebido");
          assert.equal(current.outstanding, "0.00");
          await assert.rejects(
            service.receive(
              { ...payment, id: randomUUID(), amount: "0.01" },
              users[0],
            ),
            { code: "CONFLICT" },
          );
        },
      );
      await t.test(
        "failed receipt transaction rolls back the payment",
        async () => {
          const broken = new FinanceService({
            $transaction: (
              fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
            ) =>
              db.$transaction(async (tx) => {
                await fn(tx);
                throw new Error("injected");
              }),
          } as unknown as PrismaClient);
          const before = await service.get(sale.id, users[0]);
          await assert.rejects(
            broken.receive(
              {
                ...payment,
                id: randomUUID(),
                receivableId: sale.receivables[1].id,
              },
              users[0],
            ),
          );
          assert.deepEqual(await service.get(sale.id, users[0]), before);
        },
      );
      await t.test(
        "reversals are explicit, idempotent and retain receipt history",
        async () => {
          await Promise.all([
            service.reverse(
              { receiptId: payment.id, reason: "Valor incorreto" },
              users[0],
            ),
            service.reverse(
              { receiptId: payment.id, reason: "Valor incorreto" },
              users[0],
            ),
          ]);
          const current = (await service.get(sale.id, users[0])).receivables[0];
          assert.equal(current.received, "60.00");
          assert.equal(current.outstanding, "40.00");
          assert.equal(current.receipts.length, 2);
          assert.equal(
            current.receipts.find((r) => r.id === payment.id)?.reversal?.reason,
            "Valor incorreto",
          );
          await assert.rejects(
            service.reverse(
              { receiptId: payment.id, reason: "Alterar histórico" },
              users[0],
            ),
            { code: "CONFLICT" },
          );
          await assert.rejects(service.receive(payment, users[0]), {
            code: "CONFLICT",
          });
          assert.equal((await service.overview(users[0])).received, "60.00");
        },
      );
      await t.test(
        "foreign sales, receipts and reversals cannot be accessed",
        async () => {
          await assert.rejects(service.get(sale.id, users[1]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(
            service.receive({ ...payment, id: randomUUID() }, users[1]),
            { code: "NOT_FOUND" },
          );
          await assert.rejects(
            service.reverse(
              { receiptId: payment.id, reason: "Teste" },
              users[1],
            ),
            { code: "NOT_FOUND" },
          );
          for (const view of ["sales", "accounts", "receipts"] as const) {
            const data = await service.overview(users[1], view);
            assert.equal(data.count, 0);
            assert.equal(data.sold, "0.00");
          }
          assert.deepEqual(await service.forLead(lead.id, users[1]), []);
        },
      );
      await t.test(
        "commercial snapshot and money cannot be rewritten; proposal copies remain independent",
        async () => {
          const before = await service.get(sale.id, users[0]);
          await db.lead.update({
            where: { id: lead.id },
            data: { name: "Renamed" },
          });
          await ps.duplicate(
            {
              id: proposal.id,
              leadId: lead.id,
              expectedRevision: 2,
              newId: randomUUID(),
            },
            users[0],
          );
          await ps.delete(
            { id: proposal.id, leadId: lead.id, expectedRevision: 2 },
            users[0],
          );
          assert.deepEqual(await service.get(sale.id, users[0]), before);
          await assert.rejects(
            db.sale.update({ where: { id: sale.id }, data: { total: "1" } }),
          );
          await assert.rejects(
            db.receipt.update({
              where: { id: payment.id },
              data: { amount: "1" },
            }),
          );
          await assert.rejects(
            db.receivable.update({
              where: { id: account.id },
              data: { amount: "1" },
            }),
          );
        },
      );
      await t.test(
        "accepted negotiable proposal requires final conditions and creates a separate immutable sale",
        async () => {
          let negotiated = await ps.create(
            {
              id: randomUUID(),
              leadId: lead.id,
              content: {
                ...content,
                paymentMode: "A_NEGOCIAR",
                deposit: null,
                depositMethod: null,
                depositInstallments: null,
                balanceMethod: null,
                balanceInstallments: null,
              },
            },
            users[0],
          );
          for (const status of ["ENVIADA", "ACEITA"] as const)
            negotiated = await ps.changeStatus(
              {
                id: negotiated.id,
                leadId: lead.id,
                expectedRevision: negotiated.revision,
                status,
              },
              users[0],
            );
          const result = await service.createSale(
            {
              ...payload,
              id: randomUUID(),
              proposalId: negotiated.id,
              conditions: {
                ...payload.conditions,
                deposit: "0",
                balanceMethod: "PIX",
                balanceInstallments: 1,
              },
            },
            users[0],
          );
          assert.equal(
            (await service.get(result.saleId, users[0])).receivables.length,
            1,
          );
          assert.equal(
            (await ps.get(negotiated.id, lead.id, users[0])).paymentMode,
            "A_NEGOCIAR",
          );
        },
      );
    } finally {
      const scope = { userId: { in: users } };
      await db.receiptReversal.deleteMany({
        where: { receipt: { receivable: { sale: scope } } },
      });
      await db.receipt.deleteMany({ where: { receivable: { sale: scope } } });
      await db.receivable.deleteMany({ where: { sale: scope } });
      await db.sale.deleteMany({ where: scope });
      await db.proposalStatusHistory.deleteMany({ where: { proposal: scope } });
      await db.commercialProposal.deleteMany({
        where: { ...scope, sourceProposalId: { not: null } },
      });
      await db.commercialProposal.deleteMany({ where: scope });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
