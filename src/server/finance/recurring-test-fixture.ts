import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client";

/** Disposable records owned exclusively by the test; never real customer data. */
export async function recurringFixture(db: PrismaClient) {
  const users = [randomUUID(), randomUUID()];
  const categoryId = randomUUID();
  async function cleanup() {
    const scope = { userId: { in: users } };
    await db.receiptReversal.deleteMany({
      where: { receipt: { receivable: { sale: scope } } },
    });
    await db.receipt.deleteMany({ where: { receivable: { sale: scope } } });
    await db.receivable.deleteMany({ where: { sale: scope } });
    await db.recurringContractHistory.deleteMany({
      where: { contract: { sale: scope } },
    });
    await db.recurringContract.deleteMany({ where: { sale: scope } });
    await db.sale.deleteMany({ where: scope });
    await db.commercialProposal.deleteMany({ where: scope });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.category.deleteMany({ where: { id: categoryId } });
  }
  try {
    await db.user.createMany({
      data: users.map((id) => ({
        id,
        name: "Teste recorrência",
        email: `recurring-${id}@example.invalid`,
        passwordHash: "test-only",
      })),
    });
    await db.category.create({
      data: { id: categoryId, name: `Recorrência ${categoryId}` },
    });
    const lead = await db.lead.create({
      data: {
        userId: users[0],
        categoryId,
        name: "Cliente recorrente teste",
        source: "MANUAL",
        status: "GANHO",
      },
    });
    const proposal = await db.commercialProposal.create({
      data: {
        userId: users[0],
        leadId: lead.id,
        title: "Site teste",
        description: "Desenvolvimento",
        scope: "Página",
        total: "1000",
        paymentMode: "A_NEGOCIAR",
        deliveryDays: 10,
        validUntil: new Date("2026-12-31"),
        notes: "",
        maintenance: "",
        clientName: lead.name,
        issuerName: "Teste",
        issuerEmail: "test@example.invalid",
        status: "ACEITA",
      },
    });
    const sale = await db.sale.create({
      data: {
        userId: users[0],
        leadId: lead.id,
        proposalId: proposal.id,
        clientName: lead.name,
        title: "Site teste",
        total: "1000",
        soldOn: new Date("2024-01-01"),
        proposalSnapshot: {},
        agreedConditions: {},
        requestHash: randomUUID(),
        receivables: {
          create: {
            sequence: 1,
            description: "Desenvolvimento",
            amount: "1000",
            dueOn: new Date("2024-01-10"),
            paymentMethod: "PIX",
          },
        },
      },
    });
    return { users, sale, lead, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
