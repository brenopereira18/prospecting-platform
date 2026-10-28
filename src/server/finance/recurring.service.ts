import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { accountDTO, accountInclude, FinanceError } from "./finance.service";
import { todayInSaoPaulo } from "./finance.schema";
import {
  contractTermsSchema,
  createContractSchema,
  updateContractSchema,
  contractStatusSchema,
  generateMonthlySchema,
  monthlyDueOn,
  contractStatuses,
  type ContractTerms,
} from "./recurring.schema";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const monthDate = (value: string) => date(`${value.slice(0, 7)}-01`);
const missing = () =>
  new FinanceError("NOT_FOUND", "Contrato ou venda não encontrado.");
const conflict = () =>
  new FinanceError(
    "CONFLICT",
    "O contrato foi alterado. Atualize a página antes de continuar.",
  );
const termsOf = (row: {
  kind: ContractTerms["kind"];
  description: string;
  monthlyAmount: Prisma.Decimal;
  dueDay: number;
  paymentMethod: ContractTerms["paymentMethod"];
  notes: string;
}) => ({
  kind: row.kind,
  description: row.description,
  monthlyAmount: row.monthlyAmount.toFixed(2),
  dueDay: row.dueDay,
  paymentMethod: row.paymentMethod,
  notes: row.notes,
});

export class RecurringService {
  constructor(
    private db: PrismaClient,
    private now: () => Date = () => new Date(),
  ) {}
  private user(userId: string) {
    if (!userId.trim())
      throw new FinanceError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Faça login novamente.",
      );
  }
  private async lock(tx: Prisma.TransactionClient, id: string, userId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT c.id FROM recurring_contracts c JOIN sales s ON s.id=c."saleId" JOIN leads l ON l.id=s."leadId" WHERE c.id=${id} AND s."userId"=${userId} AND l."userId"=${userId} FOR UPDATE OF c`,
    );
    const row = await tx.recurringContract.findFirst({
      where: { id, sale: { userId, lead: { userId } } },
    });
    if (!row) throw missing();
    return row;
  }
  async create(input: unknown, userId: string) {
    this.user(userId);
    const data = createContractSchema.parse(input);
    const hash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${data.saleId} AND "userId"=${userId} FOR UPDATE`,
      );
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, userId, lead: { userId } },
      });
      if (!sale) throw missing();
      const existing = await tx.recurringContract.findUnique({
        where: { id: data.id },
      });
      if (existing) {
        if (existing.saleId !== sale.id || existing.requestHash !== hash)
          throw conflict();
        return { contractId: existing.id };
      }
      if (data.startsOn < sale.soldOn.toISOString().slice(0, 10))
        throw new FinanceError(
          "INVALID",
          "O início do contrato não pode ser anterior à venda.",
        );
      await tx.recurringContract.create({
        data: {
          id: data.id,
          saleId: sale.id,
          ...data.terms,
          startsOn: date(data.startsOn),
          requestHash: hash,
          history: {
            create: {
              revision: 0,
              toStatus: "ATIVO",
              effectiveMonth: monthDate(data.startsOn),
              conditions: data.terms,
              reason: "Cadastro do contrato",
              occurredAt: this.now(),
            },
          },
        },
      });
      return { contractId: data.id };
    });
  }
  async update(input: unknown, userId: string) {
    this.user(userId);
    const data = updateContractSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data.id, userId);
      if (
        await tx.asaasCheckout.count({
          where: {
            contractId: row.id,
            status: { notIn: ["CANCELED", "EXPIRED", "REJECTED"] },
          },
        })
      )
        throw new FinanceError(
          "CONFLICT",
          "Este contrato tem uma contratação Asaas. Cancele a recorrência antes de renegociar condições e solicitar novo aceite.",
        );
      if (row.revision !== data.expectedRevision) throw conflict();
      if (row.status === "CANCELADO")
        throw new FinanceError(
          "INVALID",
          "Contratos cancelados preservam suas condições. Cadastre outro contrato para um novo acordo.",
        );
      if (JSON.stringify(termsOf(row)) === JSON.stringify(data.terms))
        return { contractId: row.id };
      const revision = row.revision + 1;
      await tx.recurringContract.update({
        where: { id: row.id },
        data: { ...data.terms, revision },
      });
      await tx.recurringContractHistory.create({
        data: {
          contractId: row.id,
          revision,
          fromStatus: row.status,
          toStatus: row.status,
          effectiveMonth: monthDate(this.effectiveDate(row.startsOn)),
          conditions: data.terms,
          reason: "Condições comerciais alteradas",
          occurredAt: this.now(),
        },
      });
      return { contractId: row.id };
    });
  }
  private effectiveDate(startsOn: Date) {
    return [todayInSaoPaulo(this.now()), startsOn.toISOString().slice(0, 10)]
      .sort()
      .at(-1)!;
  }
  async changeStatus(input: unknown, userId: string) {
    this.user(userId);
    const data = contractStatusSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data.id, userId);
      const gateway = await tx.asaasCheckout.findFirst({
        where: {
          contractId: row.id,
          status: { notIn: ["CANCELED", "EXPIRED", "REJECTED"] },
        },
        orderBy: { createdAt: "desc" },
      });
      const expectedRemote = {
        ATIVO: "ACTIVE",
        SUSPENSO: "INACTIVE",
        CANCELADO: "DELETED",
      }[data.status];
      if (gateway && gateway.subscriptionStatus !== expectedRemote)
        throw new FinanceError(
          "CONFLICT",
          "Altere a recorrência pelo painel Asaas deste contrato; a confirmação externa é obrigatória.",
        );
      if (row.revision !== data.expectedRevision) throw conflict();
      if (row.status === data.status) return { contractId: row.id };
      if (row.status === "CANCELADO")
        throw new FinanceError(
          "INVALID",
          "Um contrato cancelado não pode ser reativado. Cadastre um novo contrato.",
        );
      const revision = row.revision + 1;
      await tx.recurringContract.update({
        where: { id: row.id },
        data: { status: data.status, revision },
      });
      await tx.recurringContractHistory.create({
        data: {
          contractId: row.id,
          revision,
          fromStatus: row.status,
          toStatus: data.status,
          effectiveMonth: monthDate(this.effectiveDate(row.startsOn)),
          conditions: termsOf(row),
          reason: data.reason,
          occurredAt: this.now(),
        },
      });
      return { contractId: row.id };
    });
  }
  async generate(input: unknown, userId: string) {
    this.user(userId);
    const data = generateMonthlySchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data.id, userId);
      if (
        await tx.asaasCheckout.count({
          where: {
            contractId: row.id,
            status: { notIn: ["CANCELED", "EXPIRED", "REJECTED"] },
          },
        })
      )
        throw new FinanceError(
          "CONFLICT",
          "As mensalidades deste contrato são importadas do Asaas. Use Conciliar para evitar cobrança duplicada.",
        );
      const competence = monthDate(data.competence);
      // Retries return the immutable account even if the contract has changed since.
      const existing = await tx.receivable.findUnique({
        where: { contractId_competence: { contractId: row.id, competence } },
      });
      if (existing) return { contractId: row.id };
      if (row.revision !== data.expectedRevision) throw conflict();
      if (
        data.competence > todayInSaoPaulo(this.now()).slice(0, 7) ||
        competence < monthDate(row.startsOn.toISOString())
      )
        throw new FinanceError(
          "INVALID",
          "Escolha uma competência entre o início do contrato e o mês atual.",
        );
      const history = await tx.recurringContractHistory.findFirst({
        where: { contractId: row.id, effectiveMonth: { lte: competence } },
        orderBy: [{ effectiveMonth: "desc" }, { revision: "desc" }],
      });
      if (!history || history.toStatus !== "ATIVO")
        throw new FinanceError(
          "INVALID",
          "O contrato não está ativo nessa competência. Nenhuma mensalidade foi gerada.",
        );
      const terms = contractTermsSchema.parse(history.conditions);
      await tx.receivable.create({
        data: {
          saleId: row.saleId,
          contractId: row.id,
          competence,
          description: terms.description,
          amount: terms.monthlyAmount,
          paymentMethod: terms.paymentMethod,
          dueOn: date(
            monthlyDueOn(
              data.competence,
              terms.dueDay,
              row.startsOn.toISOString().slice(0, 10),
            ),
          ),
        },
      });
      return { contractId: row.id };
    });
  }
  async get(id: string, userId: string, page = 1) {
    this.user(userId);
    z.uuid().parse(id);
    return this.db.$transaction(
      async (tx) => {
        const row = await tx.recurringContract.findFirst({
          where: { id, sale: { userId, lead: { userId } } },
          include: {
            sale: { select: { clientName: true, title: true, leadId: true } },
            history: { orderBy: { revision: "desc" } },
            receivables: {
              include: accountInclude,
              orderBy: { competence: "desc" },
              take: 25,
              skip: this.skip(page),
            },
            _count: { select: { receivables: true } },
          },
        });
        if (!row) throw missing();
        return {
          ...row,
          monthlyAmount: row.monthlyAmount.toFixed(2),
          startsOn: row.startsOn.toISOString().slice(0, 10),
          history: row.history.map((h) => ({
            ...h,
            effectiveMonth: h.effectiveMonth.toISOString().slice(0, 7),
            occurredAt: h.occurredAt.toISOString(),
            conditions: contractTermsSchema.parse(h.conditions),
          })),
          receivables: row.receivables.map(accountDTO),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private skip(page: number) {
    return (Math.max(1, Math.min(100000, Math.trunc(page) || 1)) - 1) * 25;
  }
  async list(
    userId: string,
    input: {
      status?: string;
      search?: string;
      page?: number;
      saleId?: string;
    } = {},
  ) {
    this.user(userId);
    if (input.saleId) z.uuid().parse(input.saleId);
    const status = z.enum(contractStatuses).safeParse(input.status);
    const where: Prisma.RecurringContractWhereInput = {
      saleId: input.saleId,
      sale: {
        userId,
        lead: { userId },
        clientName: {
          contains: input.search?.trim().slice(0, 120) ?? "",
          mode: "insensitive",
        },
      },
      ...(status.success ? { status: status.data } : {}),
    };
    return this.db.$transaction(
      async (tx) => {
        const [rows, count] = await Promise.all([
          tx.recurringContract.findMany({
            where,
            include: { sale: { select: { clientName: true } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 25,
            skip: this.skip(input.page ?? 1),
          }),
          tx.recurringContract.count({ where }),
        ]);
        // A single aggregate across the page, including reversals, never N+1 queries.
        const balances = rows.length
          ? await tx.$queryRaw<
              {
                id: string;
                outstanding: Prisma.Decimal;
                overdue: Prisma.Decimal;
              }[]
            >(Prisma.sql`
        WITH accounts AS (
          SELECT r.id,r."contractId",r."dueOn",r.amount-COALESCE(SUM(p.amount) FILTER(WHERE v.id IS NULL),0) AS balance
          FROM receivables r JOIN recurring_contracts c ON c.id=r."contractId" JOIN sales s ON s.id=c."saleId"
          LEFT JOIN receipts p ON p."receivableId"=r.id LEFT JOIN receipt_reversals v ON v."receiptId"=p.id
          WHERE c.id IN (${Prisma.join(rows.map((r) => r.id))}) AND s."userId"=${userId}
          GROUP BY r.id
        ) SELECT "contractId" AS id,SUM(balance) AS outstanding,
          COALESCE(SUM(balance) FILTER(WHERE "dueOn" < ${date(todayInSaoPaulo(this.now()))}),0) AS overdue
          FROM accounts GROUP BY "contractId"`)
          : [];
        const byId = new Map(balances.map((b) => [b.id, b]));
        return {
          count,
          rows: rows.map((r) => ({
            id: r.id,
            saleId: r.saleId,
            clientName: r.sale.clientName,
            description: r.description,
            kind: r.kind,
            status: r.status,
            monthlyAmount: r.monthlyAmount.toFixed(2),
            dueDay: r.dueDay,
            outstanding: (
              byId.get(r.id)?.outstanding ?? new Prisma.Decimal(0)
            ).toFixed(2),
            overdue: (byId.get(r.id)?.overdue ?? new Prisma.Decimal(0)).toFixed(
              2,
            ),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
export type ContractDetail = Awaited<ReturnType<RecurringService["get"]>>;
