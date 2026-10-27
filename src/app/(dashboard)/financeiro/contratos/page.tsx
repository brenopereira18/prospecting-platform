import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { RecurringService } from "@/src/server/finance/recurring.service";
import {
  contractStatuses,
  statusLabels,
  kindLabels,
} from "@/src/server/finance/recurring.schema";
import {
  formatMoney,
  moneyCents,
} from "@/src/server/proposals/proposal.schema";
import {
  FinanceNavigation,
  FinanceField,
  financeInput,
  financeButton,
  ContractStatusBadge,
  contractRowGrid,
} from "@/src/components/finance/finance-ui";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    saleId?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Math.trunc(Number(query.page) || 1)),
  );
  const { rows, count } = await new RecurringService(prisma).list(user.id, {
    status: query.status,
    search: query.search,
    page,
  });
  const pageHref = (value: number) =>
    `/financeiro/contratos?${new URLSearchParams({ status: query.status ?? "", search: query.search ?? "", page: String(value) })}`;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Contratos recorrentes
        </h1>
        <p className="mt-2 text-sm text-secundary">
          Gerencie seus serviços de hospedagem, manutenção e mensalidades.
        </p>
      </header>
      <section className="min-w-0 rounded-xl border border-sidebar-hover bg-card">
        <FinanceNavigation view="contracts" />
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-sidebar-hover p-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:p-5"
          method="get"
        >
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <FinanceField label="Cliente">
              <input
                name="search"
                defaultValue={query.search}
                maxLength={120}
                placeholder="Buscar pelo cliente"
                className={financeInput}
              />
            </FinanceField>
          </div>
          <FinanceField label="Estado">
            <select
              name="status"
              aria-label="Estado"
              defaultValue={
                contractStatuses.includes(
                  query.status as (typeof contractStatuses)[number],
                )
                  ? query.status
                  : ""
              }
              className={financeInput}
            >
              <option value="">Todos</option>
              {contractStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </FinanceField>
          <button className={financeButton}>Filtrar</button>
        </form>
        <p className="px-4 py-3 text-xs text-secundary sm:px-5">
          {count} {count === 1 ? "contrato" : "contratos"}
        </p>
        {rows.length ? (
          <div>
            <div
              aria-hidden
              className={`${contractRowGrid} hidden border-b border-sidebar-hover px-5 pb-2 text-xs text-secundary lg:grid`}
            >
              <span>Cliente / serviço</span>
              <span className="text-right">Mensalidade</span>
              <span className="text-right">Saldo em aberto</span>
            </div>
            <ul className="divide-y divide-sidebar-hover">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/financeiro/contratos/${row.id}`}
                    className={`${contractRowGrid} min-w-0 items-start px-4 py-3 hover:bg-sidebar-hover/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5 lg:items-center`}
                  >
                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <h2 className="truncate font-medium">{row.clientName}</h2>
                      <p
                        className="mt-1 truncate text-sm text-secundary"
                        title={row.description}
                      >
                        {row.description}
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-secundary">
                        <span className="truncate" title={kindLabels[row.kind]}>
                          {kindLabels[row.kind]}
                        </span>
                        <ContractStatusBadge status={row.status} />
                      </div>
                    </div>
                    <div
                      className="min-w-0 text-sm lg:min-h-10 lg:text-right"
                      data-contract-column="monthly"
                    >
                      <p className="mb-1 text-xs text-secundary lg:hidden">
                        Mensalidade
                      </p>
                      <p className="whitespace-nowrap font-medium tabular-nums">
                        {formatMoney(row.monthlyAmount)}
                        <span className="hidden lg:inline"> / mês</span>
                      </p>
                      <p className="mt-1 text-xs text-secundary">
                        Vencimento dia {row.dueDay}
                      </p>
                    </div>
                    <div
                      className="min-w-0 text-right text-sm lg:min-h-10"
                      data-contract-column="outstanding"
                    >
                      <p className="mb-1 text-xs text-secundary lg:hidden">
                        Em aberto
                      </p>
                      <p className="tabular-nums">
                        {formatMoney(row.outstanding)}
                      </p>
                      {moneyCents(row.overdue) > 0 && (
                        <p className="mt-1 whitespace-nowrap text-[11px] text-amber-300 sm:text-xs">
                          Vencido: {formatMoney(row.overdue)}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <h2 className="font-medium">Nenhum contrato encontrado</h2>
            <p className="mt-2 text-sm text-secundary">
              Abra uma venda para cadastrar hospedagem ou manutenção recorrente.
            </p>
            <Link href="/financeiro" className={`${financeButton} mt-4`}>
              Acessar vendas
            </Link>
          </div>
        )}
        {(count > 25 || page > 1) && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-hover p-5 text-sm">
            <span>Página {page}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className={financeButton} href={pageHref(page - 1)}>
                  Anterior
                </Link>
              )}
              {page * 25 < count && (
                <Link className={financeButton} href={pageHref(page + 1)}>
                  Próxima
                </Link>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
