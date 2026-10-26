import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { FinanceService } from "./finance.service";
import { ProposalService } from "../proposals/proposal.service";
import { todayInSaoPaulo } from "./finance.schema";

test(
  "PostgreSQL grouped accounts: net receipts, next unpaid due date, sale pagination and ownership",
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
          name: "Grouped test",
          email: `group-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Group ${categoryId}` },
      });
      const leads = await Promise.all(
        users.map((userId) =>
          db.lead.create({
            data: {
              userId,
              categoryId,
              source: "MANUAL",
              name: "Cliente agrupado",
              status: "GANHO",
            },
          }),
        ),
      );
      const service = new FinanceService(db),
        proposals = new ProposalService(db),
        today = todayInSaoPaulo();
      async function create(
        index: number,
        owner = 0,
        depositDueOn = "2020-01-01",
        balanceDueOn = "2090-01-01",
      ) {
        let proposal = await proposals.create(
          {
            id: randomUUID(),
            leadId: leads[owner].id,
            content: {
              title: `Venda ${index}`,
              description: "Teste",
              scope: "Serviço",
              total: "400",
              paymentMode: "A_NEGOCIAR",
              deposit: null,
              depositMethod: null,
              depositInstallments: null,
              balanceMethod: null,
              balanceInstallments: null,
              deliveryDays: 1,
              validUntil: "2090-01-01",
              notes: "",
              managedHosting: false,
              monthlyAmount: null,
              maintenance: "",
            },
          },
          users[owner],
        );
        for (const status of ["ENVIADA", "ACEITA"] as const)
          proposal = await proposals.changeStatus(
            {
              id: proposal.id,
              leadId: proposal.leadId,
              expectedRevision: proposal.revision,
              status,
            },
            users[owner],
          );
        const result = await service.createSale(
          {
            id: randomUUID(),
            proposalId: proposal.id,
            leadId: proposal.leadId,
            expectedProposalRevision: proposal.revision,
            soldOn: today,
            conditions: {
              total: "400",
              deposit: "100",
              depositMethod: "PIX",
              depositInstallments: 1,
              balanceMethod: "CARTAO",
              balanceInstallments: 3,
              depositDueOn,
              balanceDueOn,
            },
          },
          users[owner],
        );
        return service.get(result.saleId, users[owner]);
      }
      const partial = await create(1),
        future = await create(2, 0, "2010-01-01"),
        settled = await create(3, 0, "2000-01-01");
      const pay = async (accountId: string, amount: string) => {
        const id = randomUUID();
        await service.receive(
          {
            id,
            receivableId: accountId,
            amount,
            receivedOn: today,
            paymentMethod: "PIX",
            notes: "Pagamento de teste",
          },
          users[0],
        );
        return id;
      };
      await pay(partial.receivables[0].id, "40");
      const reversed = await pay(partial.receivables[0].id, "10");
      await service.reverse(
        { receiptId: reversed, reason: "Correção de teste" },
        users[0],
      );
      await pay(partial.receivables[1].id, "100");
      await pay(future.receivables[0].id, "100");
      for (const account of settled.receivables)
        await pay(account.id, account.amount);
      await t.test(
        "one sale includes every account and sums partial receipts without reversed values or fan-out",
        async () => {
          const overview = await service.overview(users[0], "accounts");
          const group = overview.accounts.find((s) => s.id === partial.id)!;
          assert.equal(overview.count, 3);
          assert.equal(overview.accounts.length, 3);
          assert.equal(group.accountCount, 4);
          assert.equal(group.total, "400.00");
          assert.equal(group.received, "140.00");
          assert.equal(group.outstanding, "260.00");
          assert.equal(group.accounts[0].receipts.length, 2);
          assert.equal(group.accounts[0].received, "40.00");
          assert.equal(group.accounts[0].status, "Parcialmente recebido");
          assert.equal(group.accounts[0].overdue, true);
          assert.equal(group.overdueCount, 1);
          assert.equal(group.nextDueOn, "2020-01-01");
          assert.equal(overview.sold, "1200.00");
          assert.equal(overview.received, "640.00");
          assert.equal(overview.outstanding, "560.00");
        },
      );
      await t.test(
        "paid old due dates do not outrank overdue sales; settled sales have no pending due date and sort last",
        async () => {
          const groups = (await service.overview(users[0], "accounts"))
            .accounts;
          assert.deepEqual(
            groups.map((s) => s.id),
            [partial.id, future.id, settled.id],
          );
          assert.equal(groups[1].nextDueOn, "2090-01-01");
          assert.equal(groups[1].overdueCount, 0);
          assert.equal(groups[2].nextDueOn, null);
          assert.equal(groups[2].outstanding, "0.00");
          assert.ok(
            groups[2].accounts.every(
              (a) => a.status === "Recebido" && !a.overdue,
            ),
          );
        },
      );
      await t.test(
        "reversal reopens its account and changes the pending due date without deleting history",
        async () => {
          const account = future.receivables[0];
          const receipt = (await service.get(future.id, users[0]))
            .receivables[0].receipts[0];
          await service.reverse(
            {
              receiptId: receipt.id,
              reason: "Pagamento lançado em duplicidade",
            },
            users[0],
          );
          const groups = (await service.overview(users[0], "accounts"))
            .accounts;
          assert.equal(groups[0].id, future.id);
          assert.equal(groups[0].nextDueOn, account.dueOn);
          assert.equal(groups[0].received, "0.00");
          assert.equal(
            groups[0].accounts[0].receipts[0].reversal?.reason,
            "Pagamento lançado em duplicidade",
          );
        },
      );
      await t.test(
        "same client can have multiple distinct sale groups and foreign owners are excluded",
        async () => {
          await create(4, 1, "1990-01-01");
          const own = await service.overview(users[0], "accounts"),
            other = await service.overview(users[1], "accounts");
          assert.equal(own.count, 3);
          assert.equal(other.count, 1);
          assert.equal(other.accounts.length, 1);
          assert.equal(other.accounts[0].title, "Venda 4");
          assert.ok(
            own.accounts.every((s) =>
              s.accounts.every((a) => a.saleId === s.id),
            ),
          );
          assert.equal(
            own.accounts.filter((s) => s.clientName === "Cliente agrupado")
              .length,
            3,
          );
        },
      );
      await t.test(
        "pagination counts 25 complete sales, never cuts their accounts, and uses deterministic date ties",
        async () => {
          // Real service-created fixtures also exercise compatibility with saved documents.
          for (let i = 5; i <= 28; i++) await create(i, 0, "2021-01-01");
          const first = await service.overview(users[0], "accounts", 1),
            second = await service.overview(users[0], "accounts", 2),
            again = await service.overview(users[0], "accounts", 1);
          assert.equal(first.count, 27);
          assert.equal(second.count, 27);
          assert.equal(first.accounts.length, 25);
          assert.equal(second.accounts.length, 2);
          assert.ok(
            [...first.accounts, ...second.accounts].every(
              (s) => s.accounts.length === 4 && s.accountCount === 4,
            ),
          );
          assert.equal(
            new Set([...first.accounts, ...second.accounts].map((s) => s.id))
              .size,
            27,
          );
          assert.deepEqual(
            first.accounts.map((s) => s.id),
            again.accounts.map((s) => s.id),
          );
          assert.equal(second.accounts.at(-1)?.id, settled.id);
          assert.equal(first.sold, second.sold);
          assert.equal(first.received, second.received);
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
      await db.commercialProposal.deleteMany({ where: scope });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
