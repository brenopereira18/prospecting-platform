import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { MonthlySalesService } from "./monthly-sales.service";
import { FinanceService } from "./finance.service";
import { todayInSaoPaulo } from "./finance.schema";
import { ProposalService } from "../proposals/proposal.service";

test(
  "PostgreSQL monthly sales goals and exact sale totals",
  { skip: process.env.FINANCE_DATABASE_TEST !== "1", timeout: 120000 },
  async (t) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const users = [randomUUID(), randomUUID()],
      categoryId = randomUUID();
    const service = new MonthlySalesService(db),
      finance = new FinanceService(db),
      proposals = new ProposalService(db);
    const now = new Date("2026-10-26T15:00:00Z");
    try {
      await db.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Monthly goal test",
          email: `goal-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Goal ${categoryId}` },
      });
      const leads = await Promise.all(
        [users[0], users[0], users[1]].map((userId) =>
          db.lead.create({
            data: {
              userId,
              categoryId,
              name: "Cliente teste",
              source: "MANUAL",
              status: "GANHO",
            },
          }),
        ),
      );
      const createSale = async (
        lead: (typeof leads)[number],
        soldOn: string,
        total: string,
      ) => {
        let proposal = await proposals.create(
          {
            id: randomUUID(),
            leadId: lead.id,
            content: {
              title: "Site",
              description: "Página",
              scope: "Desenvolvimento",
              total,
              paymentMode: "A_NEGOCIAR",
              deliveryDays: 10,
              validUntil: "2027-01-01",
              notes: "",
              managedHosting: false,
              monthlyAmount: null,
              maintenance: "",
            },
          },
          lead.userId,
        );
        for (const status of ["ENVIADA", "ACEITA"] as const)
          proposal = await proposals.changeStatus(
            {
              id: proposal.id,
              leadId: lead.id,
              expectedRevision: proposal.revision,
              status,
            },
            lead.userId,
          );
        return finance.createSale(
          {
            id: randomUUID(),
            leadId: lead.id,
            proposalId: proposal.id,
            expectedProposalRevision: proposal.revision,
            soldOn,
            conditions: {
              total,
              deposit: "0",
              depositMethod: "PIX",
              depositInstallments: 1,
              balanceMethod: "PIX",
              balanceInstallments: 1,
              depositDueOn: soldOn,
              balanceDueOn: soldOn,
            },
          },
          lead.userId,
        );
      };
      await t.test(
        "absence is explicit and goals are created and edited without replacing prior months or other users",
        async () => {
          assert.equal(
            (await service.getByUser(users[0], "2026-09", now)).goal,
            null,
          );
          await service.saveGoal(
            { month: "2026-09", amount: "500.01" },
            users[0],
          );
          await service.saveGoal(
            { month: "2026-10", amount: "1000" },
            users[0],
          );
          await service.saveGoal({ month: "2026-09", amount: "75" }, users[1]);
          await service.saveGoal({ month: "2026-09", amount: "400" }, users[0]);
          assert.equal(
            (await service.getByUser(users[0], "2026-09", now)).goal,
            "400.00",
          );
          assert.equal(
            (await service.getByUser(users[0], "2026-10", now)).goal,
            "1000.00",
          );
          assert.equal(
            (await service.getByUser(users[1], "2026-09", now)).goal,
            "75.00",
          );
          assert.equal(
            await db.monthlySalesGoal.count({ where: { userId: users[0] } }),
            2,
          );
        },
      );
      const first = await createSale(leads[0], "2026-09-01", "100.01");
      await createSale(leads[0], "2026-09-30", "100.02");
      await createSale(leads[1], "2026-09-15", "99.97");
      await createSale(leads[0], "2026-08-31", "2000");
      await createSale(leads[0], "2026-10-01", "500");
      await createSale(leads[2], "2026-09-01", "9000");
      await t.test(
        "soldOn boundaries, distinct clients, ticket and ownership are calculated in PostgreSQL",
        async () => {
          const data = await service.getByUser(users[0], "2026-09", now);
          assert.equal(data.sold, "300.00");
          assert.equal(data.clients, 2);
          assert.equal(data.saleCount, 3);
          assert.equal(data.averageTicket, "100.00");
          assert.equal(data.percentage, 75);
          assert.equal(data.remaining, "100.00");
          assert.equal(
            (await service.getByUser(users[0], "2026-10", now)).sold,
            "500.00",
          );
          assert.equal(
            (await service.getByUser(users[1], "2026-09", now)).sold,
            "9000.00",
          );
        },
      );
      await t.test(
        "receivables, receipts and reversals do not change closed sales",
        async () => {
          const before = await service.getByUser(users[0], "2026-09", now);
          const sale = await finance.get(first.saleId, users[0]);
          const receiptId = randomUUID();
          await finance.receive(
            {
              id: receiptId,
              receivableId: sale.receivables[0].id,
              amount: "50",
              receivedOn: todayInSaoPaulo(),
              paymentMethod: "PIX",
              notes: "",
            },
            users[0],
          );
          assert.deepEqual(
            await service.getByUser(users[0], "2026-09", now),
            before,
          );
          await finance.reverse(
            { receiptId, reason: "Teste de estorno" },
            users[0],
          );
          assert.deepEqual(
            await service.getByUser(users[0], "2026-09", now),
            before,
          );
        },
      );
      await t.test(
        "reloading an exceeded goal preserves its full percentage and nonnegative remaining amount",
        async () => {
          await service.saveGoal({ month: "2026-09", amount: "200" }, users[0]);
          const data = await new MonthlySalesService(db).getByUser(
            users[0],
            "2026-09",
            now,
          );
          assert.equal(data.percentage, 150);
          assert.equal(data.remaining, "0.00");
          assert.equal(data.exceeded, "100.00");
        },
      );
      await t.test(
        "simultaneous saves keep a single goal per user and month",
        async () => {
          await Promise.all(
            [1, 2, 3].map(() =>
              service.saveGoal(
                { month: "2026-08", amount: "123.45" },
                users[0],
              ),
            ),
          );
          assert.equal(
            await db.monthlySalesGoal.count({
              where: {
                userId: users[0],
                month: new Date("2026-08-01T00:00:00Z"),
              },
            }),
            1,
          );
          assert.equal(
            (await service.getByUser(users[0], "2026-08", now)).goal,
            "123.45",
          );
        },
      );
    } finally {
      const sale = { userId: { in: users } };
      await db.receiptReversal.deleteMany({
        where: { receipt: { receivable: { sale } } },
      });
      await db.receipt.deleteMany({ where: { receivable: { sale } } });
      await db.receivable.deleteMany({ where: { sale } });
      await db.sale.deleteMany({ where: sale });
      await db.proposalStatusHistory.deleteMany({
        where: { proposal: { userId: { in: users } } },
      });
      await db.commercialProposal.deleteMany({
        where: { userId: { in: users } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
