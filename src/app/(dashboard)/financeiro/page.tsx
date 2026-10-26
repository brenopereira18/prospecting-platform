import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountSaleGroups } from "@/src/components/finance/account-sale-groups";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { FinanceService } from "@/src/server/finance/finance.service";
import {
  formatMoney,
  formatProposalDate,
} from "@/src/server/proposals/proposal.schema";
import {
  FinanceTotals,
  financeButton,
} from "@/src/components/finance/finance-ui";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const view =
    query.view === "accounts" || query.view === "receipts"
      ? query.view
      : "sales";
  const page = Math.max(
    1,
    Math.min(100000, Math.trunc(Number(query.page) || 1)),
  );
  const data = await new FinanceService(prisma).overview(
    user.id,
    view,
    Math.trunc(page),
  );
  const rows =
    view === "sales"
      ? data.sales.map((s) => ({
          id: s.id,
          saleId: s.id,
          client: s.clientName,
          label: s.title,
          date: s.soldOn,
          amount: s.total,
          detail: null,
          reversed: false,
        }))
      : data.receipts.map((r) => ({
          id: r.id,
          saleId: r.receivable.saleId,
          client: r.receivable.sale.clientName,
          label: r.receivable.description,
          date: r.receivedOn,
          amount: r.amount,
          reversed: Boolean(r.reversal),
          detail: r.reversal
            ? "Estornado"
            : r.paymentMethod === "PIX"
              ? "Pix"
              : "Cartão",
        }));
  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="mt-2 text-sm text-secundary">
          Suas vendas e os valores efetivamente recebidos.
        </p>
      </header>
      <FinanceTotals
        sold={data.sold}
        received={data.received}
        outstanding={data.outstanding}
      />
      <section className="min-w-0 rounded-xl border border-sidebar-hover bg-card">
        <nav
          aria-label="Visões do financeiro"
          className="grid grid-cols-3 gap-1 border-b border-sidebar-hover px-2 sm:flex sm:gap-7 sm:px-5"
        >
          {[
            ["sales", "Vendas"],
            ["accounts", "Contas a receber"],
            ["receipts", "Recebimentos"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/financeiro?view=${key}`}
              aria-current={view === key ? "page" : undefined}
              className={`flex min-h-14 items-center justify-center border-b-2 px-1 py-3 text-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary sm:shrink-0 sm:py-4 sm:text-sm ${view === key ? "border-primary text-primary" : "border-transparent text-secundary hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-2.5 text-xs text-secundary">
          <span>
            {data.count}{" "}
            {view === "receipts"
              ? data.count === 1
                ? "recebimento"
                : "recebimentos"
              : data.count === 1
                ? "venda"
                : "vendas"}
          </span>
        </div>
        {(
          view === "accounts" ? data.accounts.length === 0 : rows.length === 0
        ) ? (
          <div className="px-6 py-12 text-center">
            <h2 className="font-medium">
              {view === "sales"
                ? "Nenhuma venda registrada"
                : view === "accounts"
                  ? "Nenhuma conta a receber"
                  : "Nenhum recebimento registrado"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secundary">
              {view === "receipts"
                ? "Abra uma venda para registrar os pagamentos recebidos."
                : "Registre uma venda a partir de uma proposta aceita, na página de um lead ganho."}
            </p>
            <Link href="/leads" className={`${financeButton} mt-5`}>
              Acessar leads
            </Link>
          </div>
        ) : view === "accounts" ? (
          <AccountSaleGroups sales={data.accounts} />
        ) : (
          <ul className="divide-y divide-sidebar-hover">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/financeiro/vendas/${row.saleId}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sidebar-hover/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:grid-cols-[minmax(0,1fr)_8rem_6rem_1rem]"
                >
                  <h2
                    className="col-start-1 row-start-1 truncate text-sm font-medium"
                    title={row.client}
                  >
                    {row.client}
                  </h2>
                  <p
                    className={`col-start-2 row-start-1 whitespace-nowrap text-right text-sm tabular-nums lg:row-span-2 ${row.reversed ? "text-secundary" : "font-semibold"}`}
                  >
                    {formatMoney(row.amount)}
                  </p>
                  <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 text-xs text-secundary">
                    <p className="truncate" title={row.label}>
                      {row.label}
                      {row.detail && !row.reversed ? ` · ${row.detail}` : ""}
                    </p>
                    {row.reversed && (
                      <span className="shrink-0 rounded bg-sidebar-hover px-1.5 py-0.5 text-xs">
                        Estornado
                      </span>
                    )}
                  </div>
                  <time
                    dateTime={row.date}
                    className="col-start-2 row-start-2 whitespace-nowrap text-right text-xs text-secundary lg:col-start-3 lg:row-start-1 lg:row-span-2"
                  >
                    {formatProposalDate(row.date)}
                  </time>
                  <ChevronRight
                    aria-hidden
                    className="hidden size-4 text-secundary lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(data.count > 25 || page > 1) && (
          <footer className="flex items-center justify-between border-t border-sidebar-hover px-5 py-4 text-sm">
            <span className="text-secundary">Página {Math.trunc(page)}</span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link
                  className={financeButton}
                  href={`/financeiro?view=${view}&page=${Math.trunc(page) - 1}`}
                >
                  Anterior
                </Link>
              )}
              {page * 25 < data.count && (
                <Link
                  className={financeButton}
                  href={`/financeiro?view=${view}&page=${Math.trunc(page) + 1}`}
                >
                  Próxima
                </Link>
              )}
            </div>
          </footer>
        )}
      </section>
      <p className="text-xs leading-5 text-secundary">
        Todo o período. Mensalidades não incluídas.
      </p>
    </div>
  );
}
