import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { getCommercialPeriods } from "../leads/commercial-month";
import { FinanceError } from "./finance.service";
import {
  monthlySalesGoalSchema,
  type MonthlySalesDTO,
} from "./monthly-sales.schema";

type SalesAggregate = {
  sold: Prisma.Decimal;
  saleCount: number;
  clients: number;
};

export class MonthlySalesService {
  constructor(private readonly db: PrismaClient) {}

  private authorize(userId: string) {
    if (!userId.trim())
      throw new FinanceError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Faça login novamente.",
      );
  }

  async saveGoal(input: unknown, userId: string) {
    this.authorize(userId);
    const data = monthlySalesGoalSchema.parse(input);
    const month = new Date(`${data.month}-01T00:00:00Z`);
    // A single atomic upsert, scoped by the session owner, preserves other months.
    await this.db.monthlySalesGoal.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, amount: new Prisma.Decimal(data.amount) },
      update: { amount: new Prisma.Decimal(data.amount) },
    });
  }

  async getByUser(
    userId: string,
    requestedMonth?: unknown,
    now = new Date(),
  ): Promise<MonthlySalesDTO> {
    this.authorize(userId);
    const period = getCommercialPeriods(requestedMonth, now);
    // soldOn is a calendar DATE, not a timestamp. Applying the UTC-3 instant
    // boundary would incorrectly exclude sales dated on the first of the month.
    const start = new Date(`${period.month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const [rows, goal] = await Promise.all([
      this.db.$queryRaw<SalesAggregate[]>(Prisma.sql`
        SELECT COALESCE(SUM(s.total), 0) AS sold,
          COUNT(*)::integer AS "saleCount",
          COUNT(DISTINCT s."leadId")::integer AS clients
        FROM sales s JOIN leads l ON l.id = s."leadId"
        WHERE s."userId" = ${userId} AND l."userId" = ${userId}
          AND s."soldOn" >= ${start}::date AND s."soldOn" < ${end}::date
      `),
      this.db.monthlySalesGoal.findUnique({
        where: { userId_month: { userId, month: start } },
      }),
    ]);
    const totals = rows[0];
    const sold = new Prisma.Decimal(totals?.sold ?? 0);
    const count = totals?.saleCount ?? 0;
    const target = goal?.amount ?? null;
    return {
      month: period.month,
      label: period.label,
      partial: period.partial,
      sold: sold.toFixed(2),
      saleCount: count,
      clients: totals?.clients ?? 0,
      averageTicket: count ? sold.div(count).toFixed(2) : "0.00",
      goal: target?.toFixed(2) ?? null,
      percentage: target
        ? sold.div(target).mul(100).toDecimalPlaces(1).toNumber()
        : null,
      remaining: target
        ? Prisma.Decimal.max(target.minus(sold), 0).toFixed(2)
        : null,
      exceeded: target
        ? Prisma.Decimal.max(sold.minus(target), 0).toFixed(2)
        : null,
    };
  }
}
