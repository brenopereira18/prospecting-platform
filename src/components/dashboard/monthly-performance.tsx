import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type {
  LeadMonthlyPerformanceDTO,
  MonthlyMetric,
} from "../../server/leads/commercial-month";
import { MonthlyMonthPicker } from "./monthly-month-picker";

const number = new Intl.NumberFormat("pt-BR");
const signed = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });
const percentage = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const metrics = [
  ["registered", "Leads cadastrados"],
  ["proposals", "Propostas enviadas"],
  ["won", "Ganhos"],
  ["lost", "Perdidos"],
] as const;

function trendText(metric: MonthlyMetric, available: boolean) {
  if (!available || metric.comparison === "unavailable") return "—";
  if (metric.comparison === "stable") return "Sem variação";
  return `${signed.format(metric.difference ?? 0)} ${Math.abs(metric.difference ?? 0) === 1 ? "lead" : "leads"}${metric.percentageChange !== null ? ` (${percentage.format(metric.percentageChange)}%)` : ""}`;
}
export function MonthlyPerformance({
  data,
}: {
  data: LeadMonthlyPerformanceDTO;
}) {
  const label =
    data.label.charAt(0).toLocaleUpperCase("pt-BR") + data.label.slice(1);
  const partialHistory = [
    data.coverage.selected,
    data.coverage.comparisonSelected,
    data.coverage.previous,
  ].includes("partial");
  return (
    <section
      aria-labelledby="monthly-performance-title"
      className="mt-6 rounded-xl border border-sidebar-hover bg-card"
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2
            id="monthly-performance-title"
            className="text-base font-semibold"
          >
            Desempenho comercial
          </h2>
          <p className="mt-1 text-sm text-secundary">
            {label} · {data.partial ? "Em andamento" : "Encerrado"}
          </p>
        </div>
        <MonthlyMonthPicker month={data.month} max={data.currentMonth} />
      </div>
      {data.selectionWarning && (
        <p role="status" className="px-5 pb-4 text-sm text-secundary sm:px-6">
          {data.selectionWarning}
        </p>
      )}
      <div className="grid grid-cols-1 border-t border-sidebar-hover sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([key, title], index) => {
          const metric = data.metrics[key];
          const text = trendText(metric, data.comparisonPeriod.available);
          const comparable =
            data.comparisonPeriod.available &&
            metric.comparison === "comparable";
          const improving =
            key === "lost"
              ? (metric.difference ?? 0) < 0
              : (metric.difference ?? 0) > 0;
          const Icon =
            (metric.difference ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <article
              key={key}
              aria-label={title}
              className={`min-w-0 px-5 py-5 sm:px-6 ${index > 0 ? "border-t border-sidebar-hover" : ""} ${index % 2 === 1 ? "sm:border-l" : ""} ${index < 2 ? "sm:border-t-0" : ""} ${index > 0 ? "xl:border-t-0 xl:border-l" : ""}`}
            >
              <h3 className="text-sm font-medium text-secundary">{title}</h3>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {metric.current === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Total indisponível</span>
                  </>
                ) : (
                  number.format(metric.current)
                )}
              </p>
              <p
                aria-label={
                  text === "—"
                    ? "Comparação indisponível"
                    : `Tendência de ${title}: ${text}${comparable ? `. ${improving ? "Melhora" : "Piora"} no período` : ""}`
                }
                className={`mt-3 flex min-h-5 items-center gap-1.5 text-xs font-medium tabular-nums ${comparable ? (improving ? "text-primary" : "text-red-300") : "text-secundary"}`}
              >
                {comparable && (
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                )}
                {metric.comparison === "stable" &&
                  data.comparisonPeriod.available && (
                    <Minus aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                {text}
              </p>
            </article>
          );
        })}
      </div>
      {partialHistory && (
        <p className="border-t border-sidebar-hover px-5 py-3 text-xs leading-5 text-secundary sm:px-6">
          Histórico parcial: dados e comparações limitados ao período
          registrado.
        </p>
      )}
    </section>
  );
}
