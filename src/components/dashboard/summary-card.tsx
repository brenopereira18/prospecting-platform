import { Trophy, TrendingUp, Wallet } from "lucide-react";

export function SummaryCard() {
  return (
    <section className="relative bg-primary rounded-xl text-terciary">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-stretch">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-primary-foreground/80">
            <Wallet className="h-4 w-4" />

            <span className="text-sm font-medium uppercase tracking-wide">
              Faturamento do mês
            </span>
          </div>

          <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            R$ 2.100
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" />
              -50% vs. mês anterior
            </span>

            <span className="text-xs text-primary-foreground/70">
              Ticket médio R$ 2.100
            </span>
          </div>
        </div>

        <div className="hidden w-px bg-white/15 lg:block" />

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Trophy className="h-4 w-4" />

              <span className="text-sm font-medium uppercase tracking-wide">
                Clientes fechados
              </span>
            </div>

            <div className="inline-flex items-center rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground backdrop-blur">
              Meta: 4
            </div>
          </div>

          <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            1
            <span className="text-2xl font-normal text-primary-foreground/60">
              {" "}
              / 4
            </span>
          </p>

          <div className="mt-3">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-1/4 bg-white transition-all" />
            </div>

            <p className="mt-2 text-xs text-primary-foreground/70">
              25% da meta mensal atingida
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
