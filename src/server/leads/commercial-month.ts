import { z } from "zod";

export const COMMERCIAL_TIME_ZONE = "America/Sao_Paulo";
export const commercialMonthSchema = z
  .string()
  .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMMERCIAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: COMMERCIAL_TIME_ZONE,
  month: "long",
  year: "numeric",
});

function parts(instant: Date) {
  return Object.fromEntries(
    localParts.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
}

function monthKey(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function localTimestamp(instant: number) {
  const p = parts(new Date(instant));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

// IANA offsets on either side handle DST gaps and repeated local midnights.
function localDayStart(year: number, month: number, day = 1) {
  const local = Date.UTC(year, month - 1, day);
  const candidates = [-86_400_000, 0, 86_400_000].map((distance) => {
    const sample = local + distance;
    return local - (localTimestamp(sample) - sample);
  });
  const valid = candidates.filter(
    (instant) => localTimestamp(instant) >= local,
  );
  return new Date(Math.min(...valid));
}

export function getCommercialPeriods(
  requestedMonth: unknown,
  now = new Date(),
) {
  const today = parts(now);
  const currentMonth = `${today.year}-${today.month}`;
  const parsed = commercialMonthSchema.safeParse(requestedMonth);
  const valid = parsed.success && parsed.data <= currentMonth;
  const month = valid ? parsed.data : currentMonth;
  const [year, value] = month.split("-").map(Number);
  const previousYear = value === 1 ? year - 1 : year;
  const previousValue = value === 1 ? 12 : value - 1;
  const start = localDayStart(year, value);
  const next = localDayStart(
    value === 12 ? year + 1 : year,
    value === 12 ? 1 : value + 1,
  );
  const previousStart = localDayStart(previousYear, previousValue);
  const partial = month === currentMonth;
  const previousDays = new Date(Date.UTC(year, value - 1, 0)).getUTCDate();
  const completeDays = partial ? Math.min(+today.day - 1, previousDays) : null;
  const comparison = {
    currentEnd:
      completeDays === null
        ? next
        : localDayStart(year, value, completeDays + 1),
    previousEnd:
      completeDays === null
        ? start
        : localDayStart(previousYear, previousValue, completeDays + 1),
    completeDays,
    available: completeDays !== 0,
    label:
      completeDays === null
        ? `Comparação com ${monthLabel.format(previousStart)}, ambos os meses completos.`
        : completeDays === 0
          ? "Ainda não há dias completos neste mês para comparação."
          : `Comparação: 1 a ${completeDays} de ${monthLabel.format(start)} vs. 1 a ${completeDays} de ${monthLabel.format(previousStart)}.`,
  };
  return {
    month,
    currentMonth,
    previousMonth: monthKey(previousYear, previousValue),
    label: monthLabel.format(start),
    previousLabel: monthLabel.format(previousStart),
    start,
    end: partial ? now : next,
    previousStart,
    partial,
    comparison,
    selectionWarning:
      requestedMonth === undefined || valid
        ? null
        : "Mês inválido ou futuro. Exibindo o mês atual.",
  };
}

export type HistoryCoverage =
  | "complete"
  | "partial"
  | "unavailable"
  | "unknown";

export function getHistoryCoverage(
  start: Date,
  end: Date,
  since: Date | null,
): HistoryCoverage {
  if (!since) return "unknown";
  if (since >= end) return "unavailable";
  return since > start ? "partial" : "complete";
}

export function compareMonthlyValues(
  current: number | null,
  previous: number | null,
  comparable = true,
) {
  if (current === null || previous === null || !comparable)
    return {
      current,
      previous,
      difference: null,
      percentageChange: null,
      comparison: "unavailable" as const,
    };
  const difference = current - previous;
  const comparison =
    difference === 0 ? "stable" : previous === 0 ? "no-base" : "comparable";
  return {
    current,
    previous,
    difference,
    percentageChange: previous > 0 ? (difference / previous) * 100 : null,
    comparison,
  };
}

export function buildMonthlyMetric(
  total: number | null,
  comparisonCurrent: number | null,
  previous: number | null,
  comparable = true,
) {
  return {
    ...compareMonthlyValues(comparisonCurrent, previous, comparable),
    current: total,
    comparisonCurrent,
  };
}

export type MonthlyMetric = ReturnType<typeof buildMonthlyMetric>;
export type LeadMonthlyPerformanceDTO = {
  month: string;
  currentMonth: string;
  previousMonth: string;
  label: string;
  previousLabel: string;
  partial: boolean;
  asOf: string;
  selectionWarning: string | null;
  comparisonPeriod: {
    available: boolean;
    completeDays: number | null;
    label: string;
  };
  coverage: {
    since: string | null;
    selected: HistoryCoverage;
    comparisonSelected: HistoryCoverage;
    previous: HistoryCoverage;
  };
  metrics: Record<"registered" | "proposals" | "won" | "lost", MonthlyMetric>;
};
