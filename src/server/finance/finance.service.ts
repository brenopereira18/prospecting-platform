import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import {
  saleSchema,
  receiptSchema,
  reversalSchema,
  collectionSchedule,
  todayInSaoPaulo,
  receivableState,
} from "./finance.schema";

export class FinanceError extends Error {
  constructor(
    public readonly code:
      "UNAUTHENTICATED" | "NOT_FOUND" | "CONFLICT" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const missing = () =>
  new FinanceError("NOT_FOUND", "Registro financeiro não encontrado.");
const conflict = () =>
  new FinanceError(
    "CONFLICT",
    "Este registro já existe com outros dados. Abra o registro salvo antes de continuar.",
  );
export const accountInclude = {
  receipts: {
    include: { reversal: true },
    orderBy: [{ receivedOn: "desc" as const }, { id: "desc" as const }],
  },
};
export function accountDTO(
  row: Prisma.ReceivableGetPayload<{ include: typeof accountInclude }>,
) {
  const received = row.receipts
    .reduce(
      (sum, r) => (r.reversal ? sum : sum.plus(r.amount)),
      new Prisma.Decimal(0),
    )
    .toFixed(2);
  return {
    ...row,
    competence: row.competence?.toISOString().slice(0, 7) ?? null,
    amount: row.amount.toFixed(2),
    dueOn: row.dueOn.toISOString().slice(0, 10),
    received,
    ...receivableState(
      row.amount.toFixed(2),
      received,
      row.dueOn.toISOString(),
    ),
    receipts: row.receipts.map((r) => ({
      ...r,
      amount: r.amount.toFixed(2),
      receivedOn: r.receivedOn.toISOString().slice(0, 10),
      createdAt: r.createdAt.toISOString(),
      reversal: r.reversal
        ? { ...r.reversal, createdAt: r.reversal.createdAt.toISOString() }
        : null,
    })),
  };
}
export class FinanceService {
  constructor(private db: PrismaClient) {}
  private user(id: string) {
    if (!id.trim())
      throw new FinanceError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Faça login novamente.",
      );
  }
  async createSale(input: unknown, userId: string) {
    this.user(userId);
    const data = saleSchema.parse(input);
    if (data.soldOn > todayInSaoPaulo())
      throw new FinanceError(
        "INVALID",
        "A data da venda não pode estar no futuro.",
      );
    const hash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM leads WHERE id=${data.leadId} AND "userId"=${userId} FOR UPDATE`,
      );
      const lead = await tx.lead.findFirst({
        where: { id: data.leadId, userId },
      });
      if (!lead) throw missing();
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM commercial_proposals WHERE id=${data.proposalId} AND "userId"=${userId} FOR UPDATE`,
      );
      const proposal = await tx.commercialProposal.findFirst({
        where: { id: data.proposalId, leadId: lead.id, userId },
      });
      if (!proposal) throw missing();
      const existing = await tx.sale.findFirst({
        where: { OR: [{ proposalId: proposal.id }, { id: data.id }] },
      });
      if (existing) {
        if (existing.userId === userId && existing.requestHash === hash)
          return { saleId: existing.id, leadId: existing.leadId };
        throw conflict();
      }
      if (
        lead.status !== "GANHO" ||
        proposal.status !== "ACEITA" ||
        proposal.deletedAt
      )
        throw new FinanceError(
          "INVALID",
          "Registre vendas somente para leads ganhos e propostas aceitas disponíveis.",
        );
      if (proposal.revision !== data.expectedProposalRevision)
        throw new FinanceError(
          "CONFLICT",
          "A proposta foi alterada. Reabra o formulário.",
        );
      if (!proposal.total.equals(data.conditions.total))
        throw new FinanceError(
          "INVALID",
          "O total deve corresponder à proposta aceita.",
        );
      if (proposal.paymentMode === "DEFINIDAS") {
        const agreed = {
          deposit: proposal.deposit!.toFixed(2),
          depositMethod: proposal.depositMethod,
          depositInstallments: proposal.depositInstallments,
          balanceMethod: proposal.balanceMethod,
          balanceInstallments: proposal.balanceInstallments,
        };
        if (
          Object.entries(agreed).some(
            ([k, v]) =>
              data.conditions[k as keyof typeof data.conditions] !== v,
          )
        )
          throw new FinanceError(
            "INVALID",
            "Preserve as condições da proposta aceita. Para renegociar, duplique a proposta.",
          );
      }
      // Snapshot contains only stored data, never a pointer to mutable commercial fields.
      const snapshot = JSON.parse(
        JSON.stringify(proposal),
      ) as Prisma.InputJsonValue;
      await tx.sale.create({
        data: {
          id: data.id,
          userId,
          leadId: lead.id,
          proposalId: proposal.id,
          clientName: proposal.clientName,
          title: proposal.title,
          total: proposal.total,
          soldOn: date(data.soldOn),
          proposalSnapshot: snapshot,
          agreedConditions: data.conditions,
          requestHash: hash,
          receivables: {
            create: collectionSchedule(data.conditions).map((r) => ({
              ...r,
              amount: new Prisma.Decimal(r.amount),
              dueOn: date(r.dueOn),
            })),
          },
        },
      });
      return { saleId: data.id, leadId: lead.id };
    });
  }
  private async lockAccount(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT r.id FROM receivables r JOIN sales s ON s.id=r."saleId" WHERE r.id=${id} AND s."userId"=${userId} FOR UPDATE OF r`,
    );
    const row = await tx.receivable.findFirst({
      where: { id, sale: { userId, lead: { userId } } },
      include: { sale: true },
    });
    if (!row) throw missing();
    return row;
  }
  async receive(input: unknown, userId: string) {
    this.user(userId);
    const data = receiptSchema.parse(input);
    if (data.receivedOn > todayInSaoPaulo())
      throw new FinanceError(
        "INVALID",
        "Recebimentos devem ter uma data efetiva, até hoje.",
      );
    return this.db.$transaction((tx) =>
      this.receiveInTransaction(tx, data, userId),
    );
  }
  // Used by both manual receipts and verified provider settlement, in the caller's transaction.
  async receiveInTransaction(
    tx: Prisma.TransactionClient,
    data: z.infer<typeof receiptSchema>,
    userId: string,
    asaasPaymentId?: string,
  ) {
    this.user(userId);
    receiptSchema.parse(data);
    const account = await this.lockAccount(tx, data.receivableId, userId);
    if (
      !asaasPaymentId &&
      (await tx.asaasCheckout.count({
        where: {
          saleId: account.saleId,
          contractId: account.contractId,
          status: { notIn: ["CANCELED", "EXPIRED", "REJECTED"] },
        },
      }))
    )
      throw new FinanceError(
        "CONFLICT",
        "Esta conta possui cobrança Asaas. Concilie ou cancele o checkout antes de registrar um recebimento manual.",
      );
    const existing = await tx.receipt.findUnique({
      where: { id: data.id },
      include: { reversal: true },
    });
    if (existing) {
      if (
        existing.receivableId !== account.id ||
        !existing.amount.equals(data.amount) ||
        existing.receivedOn.toISOString().slice(0, 10) !== data.receivedOn ||
        existing.paymentMethod !== data.paymentMethod ||
        existing.notes !== data.notes ||
        existing.reversal
      )
        throw conflict();
      return { saleId: account.saleId, leadId: account.sale.leadId };
    }
    const paid = await tx.receipt.aggregate({
      where: { receivableId: account.id, reversal: null },
      _sum: { amount: true },
    });
    const balance = account.amount.minus(paid._sum.amount ?? 0);
    if (balance.lessThan(data.amount))
      throw new FinanceError(
        "CONFLICT",
        "O valor ultrapassa o saldo disponível. Atualize a conta e revise o recebimento.",
      );
    await tx.receipt.create({
      data: {
        ...data,
        amount: new Prisma.Decimal(data.amount),
        receivedOn: date(data.receivedOn),
        asaasPaymentId,
      },
    });
    return { saleId: account.saleId, leadId: account.sale.leadId };
  }
  async reverse(input: unknown, userId: string) {
    this.user(userId);
    const data = reversalSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const receipt = await tx.receipt.findFirst({
        where: {
          id: data.receiptId,
          receivable: { sale: { userId, lead: { userId } } },
        },
      });
      if (!receipt) throw missing();
      if (receipt.asaasPaymentId)
        throw new FinanceError(
          "INVALID",
          "Solicite o estorno no Asaas e concilie a cobrança. O histórico será preservado.",
        );
      const account = await this.lockAccount(tx, receipt.receivableId, userId);
      const existing = await tx.receiptReversal.findUnique({
        where: { receiptId: receipt.id },
      });
      if (existing && existing.reason !== data.reason) throw conflict();
      if (!existing) await tx.receiptReversal.create({ data });
      return { saleId: account.saleId, leadId: account.sale.leadId };
    });
  }
  async get(id: string, userId: string) {
    this.user(userId);
    z.uuid().parse(id);
    const row = await this.db.sale.findFirst({
      where: { id, userId, lead: { userId } },
      include: {
        receivables: {
          where: { contractId: null },
          include: accountInclude,
          orderBy: { sequence: "asc" },
        },
      },
    });
    if (!row) throw missing();
    return {
      ...row,
      total: row.total.toFixed(2),
      soldOn: row.soldOn.toISOString().slice(0, 10),
      createdAt: row.createdAt.toISOString(),
      receivables: row.receivables.map(accountDTO),
    };
  }
  async forLead(leadId: string, userId: string) {
    this.user(userId);
    z.uuid().parse(leadId);
    return this.db.sale.findMany({
      where: { leadId, userId, lead: { userId } },
      select: { id: true, proposalId: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  async overview(
    userId: string,
    view: "sales" | "accounts" | "receipts" = "sales",
    page = 1,
  ) {
    this.user(userId);
    const skip =
      (Math.max(1, Math.min(100000, Math.trunc(page) || 1)) - 1) * 25;
    // A repeatable-read snapshot keeps the totals and rows mutually consistent.
    return this.db.$transaction(
      async (tx) => {
        const scope = { userId, lead: { userId } };
        const [sold, paid, sales, accounts, receipts, count] =
          await Promise.all([
            tx.sale.aggregate({ where: scope, _sum: { total: true } }),
            tx.receipt.aggregate({
              where: {
                receivable: { sale: scope, contractId: null },
                reversal: null,
              },
              _sum: { amount: true },
            }),
            view === "sales"
              ? tx.sale.findMany({
                  where: scope,
                  select: {
                    id: true,
                    title: true,
                    clientName: true,
                    leadId: true,
                    total: true,
                    soldOn: true,
                  },
                  orderBy: [{ soldOn: "desc" }, { id: "desc" }],
                  skip,
                  take: 25,
                })
              : [],
            view === "accounts" ? this.groupedAccounts(tx, userId, skip) : [],
            view === "receipts"
              ? tx.receipt.findMany({
                  where: { receivable: { sale: scope, contractId: null } },
                  include: {
                    reversal: true,
                    receivable: {
                      select: {
                        saleId: true,
                        description: true,
                        sale: { select: { clientName: true } },
                      },
                    },
                  },
                  orderBy: [{ receivedOn: "desc" }, { id: "desc" }],
                  skip,
                  take: 25,
                })
              : [],
            view === "sales"
              ? tx.sale.count({ where: scope })
              : view === "accounts"
                ? tx.sale.count({
                    where: {
                      ...scope,
                      receivables: { some: { contractId: null } },
                    },
                  })
                : tx.receipt.count({
                    where: { receivable: { sale: scope, contractId: null } },
                  }),
          ]);
        return {
          sold: (sold._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
          received: (paid._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
          outstanding: (sold._sum.total ?? new Prisma.Decimal(0))
            .minus(paid._sum.amount ?? 0)
            .toFixed(2),
          count,
          sales: sales.map((s) => ({
            ...s,
            total: s.total.toFixed(2),
            soldOn: s.soldOn.toISOString().slice(0, 10),
          })),
          accounts,
          receipts: receipts.map((r) => ({
            ...r,
            amount: r.amount.toFixed(2),
            receivedOn: r.receivedOn.toISOString().slice(0, 10),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async groupedAccounts(
    tx: Prisma.TransactionClient,
    userId: string,
    skip: number,
  ) {
    // Aggregate receipts per account before ordering sales. Reversed receipts do
    // not settle an account; paid dates never outrank an unpaid due date.
    const ordered = await tx.$queryRaw<
      { id: string; nextDueOn: Date | null }[]
    >(Prisma.sql`
      WITH balances AS (
        SELECT r.id, r."saleId", r."dueOn", r.amount,
          COALESCE(SUM(p.amount) FILTER (WHERE reversal.id IS NULL), 0) AS received
        FROM receivables r
        JOIN sales s ON s.id = r."saleId"
        JOIN leads l ON l.id = s."leadId"
        LEFT JOIN receipts p ON p."receivableId" = r.id
        LEFT JOIN receipt_reversals reversal ON reversal."receiptId" = p.id
        WHERE s."userId" = ${userId} AND l."userId" = ${userId} AND r."contractId" IS NULL
        GROUP BY r.id, r."saleId", r."dueOn", r.amount
      )
      SELECT "saleId" AS id,
        MIN("dueOn") FILTER (WHERE amount > received) AS "nextDueOn"
      FROM balances
      GROUP BY "saleId"
      ORDER BY "nextDueOn" ASC NULLS LAST, "saleId" ASC
      LIMIT 25 OFFSET ${skip}
    `);
    if (!ordered.length) return [];
    const rows = await tx.sale.findMany({
      where: {
        id: { in: ordered.map((row) => row.id) },
        userId,
        lead: { userId },
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        total: true,
        receivables: {
          where: { contractId: null },
          include: accountInclude,
          orderBy: { sequence: "asc" },
        },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ordered.map(({ id, nextDueOn }) => {
      const row = byId.get(id)!;
      const accounts = row.receivables.map(accountDTO);
      const received = accounts.reduce(
        (sum, account) => sum.plus(account.received),
        new Prisma.Decimal(0),
      );
      return {
        id,
        title: row.title,
        clientName: row.clientName,
        total: row.total.toFixed(2),
        received: received.toFixed(2),
        outstanding: row.total.minus(received).toFixed(2),
        accountCount: accounts.length,
        overdueCount: accounts.filter((account) => account.overdue).length,
        nextDueOn: nextDueOn?.toISOString().slice(0, 10) ?? null,
        accounts,
      };
    });
  }
}
export type SaleDetail = Awaited<ReturnType<FinanceService["get"]>>;
export type AccountSaleGroup = Awaited<
  ReturnType<FinanceService["overview"]>
>["accounts"][number];
