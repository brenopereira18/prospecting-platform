import type { PrismaClient } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma/client";
import {
  buildMonthlyMetric,
  getCommercialPeriods,
  getHistoryCoverage,
  type LeadMonthlyPerformanceDTO,
} from "./commercial-month";

export const STATUS_HISTORY_MIGRATION =
  "20261022160000_create_lead_status_history";
type EventStatus = "PROPOSTA_ENVIADA" | "GANHO" | "PERDIDO";
type EventCount = {
  status: EventStatus;
  total: number;
  current: number;
  previous: number;
};

export class LeadMonthlyService {
  constructor(
    private readonly db: Pick<PrismaClient, "lead" | "$queryRaw"> = prisma,
  ) {}

  async getByUser(
    userId: string,
    requestedMonth?: unknown,
    now = new Date(),
  ): Promise<LeadMonthlyPerformanceDTO> {
    if (!userId.trim()) throw new Error("Usuário não autenticado.");
    const period = getCommercialPeriods(requestedMonth, now);
    const totalRegistrations = Promise.resolve(
      this.db.lead.count({
        where: { userId, createdAt: { gte: period.start, lt: period.end } },
      }),
    );
    const [
      currentRegistrations,
      comparisonRegistrations,
      previousRegistrations,
      coverageRows,
      events,
    ] = await Promise.all([
      totalRegistrations,
      !period.comparison.available
        ? Promise.resolve(null)
        : !period.partial
          ? totalRegistrations
          : this.db.lead.count({
              where: {
                userId,
                createdAt: {
                  gte: period.start,
                  lt: period.comparison.currentEnd,
                },
              },
            }),
      !period.comparison.available
        ? Promise.resolve(null)
        : this.db.lead.count({
            where: {
              userId,
              createdAt: {
                gte: period.previousStart,
                lt: period.comparison.previousEnd,
              },
            },
          }),
      // Actual installation time, never the first event or Lead.updatedAt.
      this.db.$queryRaw<{ since: Date | null }[]>`
        SELECT MIN(finished_at) AS "since" FROM "_prisma_migrations"
        WHERE migration_name = ${STATUS_HISTORY_MIGRATION}
          AND finished_at IS NOT NULL AND rolled_back_at IS NULL
      `,
      // Overlapping total/comparable windows need independent DISTINCT counts.
      this.db.$queryRaw<EventCount[]>`
        SELECT h."toStatus" AS "status",
          (COUNT(DISTINCT h."leadId") FILTER (WHERE h."occurredAt" >= ${period.start} AND h."occurredAt" < ${period.end}))::integer AS "total",
          (COUNT(DISTINCT h."leadId") FILTER (WHERE h."occurredAt" >= ${period.start} AND h."occurredAt" < ${period.comparison.currentEnd}))::integer AS "current",
          (COUNT(DISTINCT h."leadId") FILTER (WHERE h."occurredAt" >= ${period.previousStart} AND h."occurredAt" < ${period.comparison.previousEnd}))::integer AS "previous"
        FROM "lead_status_history" h
        JOIN "leads" l ON l."id" = h."leadId"
        WHERE l."userId" = ${userId}
          AND ((h."occurredAt" >= ${period.start} AND h."occurredAt" < ${period.end})
            OR (h."occurredAt" >= ${period.previousStart} AND h."occurredAt" < ${period.comparison.previousEnd}))
          AND h."toStatus" IN ('PROPOSTA_ENVIADA', 'GANHO', 'PERDIDO')
        GROUP BY h."toStatus"
      `,
    ]);
    const since = coverageRows[0]?.since ?? null;
    const selected = getHistoryCoverage(period.start, period.end, since);
    const comparisonSelected = getHistoryCoverage(
      period.start,
      period.comparison.currentEnd,
      since,
    );
    const previous = getHistoryCoverage(
      period.previousStart,
      period.comparison.previousEnd,
      since,
    );
    const stage = (status: EventStatus) => {
      const counts = events.find((event) => event.status === status);
      const count = (
        key: "total" | "current" | "previous",
        coverage: typeof selected,
      ) =>
        coverage === "unknown" || coverage === "unavailable"
          ? null
          : (counts?.[key] ?? 0);
      return buildMonthlyMetric(
        count("total", selected),
        period.comparison.available
          ? count("current", comparisonSelected)
          : null,
        period.comparison.available ? count("previous", previous) : null,
        period.comparison.available &&
          comparisonSelected === "complete" &&
          previous === "complete",
      );
    };
    return {
      month: period.month,
      currentMonth: period.currentMonth,
      previousMonth: period.previousMonth,
      label: period.label,
      previousLabel: period.previousLabel,
      partial: period.partial,
      asOf: now.toISOString(),
      selectionWarning: period.selectionWarning,
      comparisonPeriod: {
        available: period.comparison.available,
        completeDays: period.comparison.completeDays,
        label: period.comparison.label,
      },
      coverage: {
        since: since?.toISOString() ?? null,
        selected,
        comparisonSelected,
        previous,
      },
      metrics: {
        registered: buildMonthlyMetric(
          currentRegistrations,
          comparisonRegistrations,
          previousRegistrations,
          period.comparison.available,
        ),
        proposals: stage("PROPOSTA_ENVIADA"),
        won: stage("GANHO"),
        lost: stage("PERDIDO"),
      },
    };
  }
}
