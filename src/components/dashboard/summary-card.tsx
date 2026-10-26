import { Wallet } from "lucide-react";
import type { MonthlySalesDTO } from "../../server/finance/monthly-sales.schema";
import { MonthlyGoalForm } from "./monthly-goal-form";

const money = (value: string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function SummaryCard({ data }: { data: MonthlySalesDTO }) {
  const reached = data.remaining === "0.00";
  const exceeded = data.exceeded !== null && data.exceeded !== "0.00";
  return (
    <section
      aria-labelledby="monthly-sales-title"
      className="rounded-xl bg-primary text-terciary"
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wallet aria-hidden="true" className="size-4" />
            <h2 id="monthly-sales-title" className="text-sm font-medium">
              Vendas fechadas no mês
            </h2>
          </div>
          <p className="mt-1 text-xs">
            {data.label} · {data.partial ? "Em andamento" : "Encerrado"}
          </p>
          <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
            {money(data.sold)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="flex min-w-0 flex-col">
              <dt
                className="text-xs"
                title="Estabelecimentos distintos com vendas registradas no mês."
              >
                Clientes conquistados
                <span className="sr-only">
                  : estabelecimentos distintos com vendas no mês
                </span>
              </dt>
              <dd className="mt-auto pt-1 text-lg font-semibold tabular-nums">
                {data.clients.toLocaleString("pt-BR")}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col">
              <dt
                className="text-xs"
                title="Total vendido dividido pela quantidade de vendas do mês."
              >
                Ticket médio
              </dt>
              <dd className="mt-auto break-words pt-1 text-lg font-semibold tabular-nums">
                {money(data.averageTicket)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="min-w-0 border-t border-black/15 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <MonthlyGoalForm
            key={data.month}
            month={data.month}
            label={data.label}
            amount={data.goal}
          />
          {data.goal === null ? (
            <p className="mt-3 max-w-sm text-sm leading-6">
              Defina uma meta mensal para acompanhar seu progresso.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-words text-2xl font-semibold tracking-tight tabular-nums">
                  {money(data.goal)}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {percent.format(data.percentage!)}% atingido
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Progresso da meta de vendas"
                aria-valuemin={0}
                aria-valuemax={Math.max(100, data.percentage!)}
                aria-valuenow={data.percentage!}
                aria-valuetext={`${percent.format(data.percentage!)}% da meta de ${money(data.goal)}`}
                className="mt-4 h-2 overflow-hidden rounded-full bg-black/15"
              >
                {/* Only the physical track is bounded; the percentage stays uncapped. */}
                <div
                  style={{ width: `${Math.min(100, data.percentage!)}%` }}
                  className="h-full rounded-full bg-terciary"
                />
              </div>
              <p className="mt-3 text-sm tabular-nums">
                {exceeded
                  ? `Meta superada em ${money(data.exceeded!)}.`
                  : reached
                    ? "Meta atingida."
                    : `Faltam ${money(data.remaining!)} para atingir a meta.`}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
