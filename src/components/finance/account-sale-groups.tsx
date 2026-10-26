import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { AccountSaleGroup } from "@/src/server/finance/finance.service";
import {
  formatMoney,
  formatProposalDate,
} from "@/src/server/proposals/proposal.schema";
import { ReceivableList } from "./receivable-card";

export function AccountSaleGroups({ sales }: { sales: AccountSaleGroup[] }) {
  return (
    <ul
      aria-label="Vendas com contas a receber"
      className="divide-y divide-sidebar-hover"
    >
      {sales.map((sale) => (
        <li key={sale.id}>
          <details className="group/sale">
            <summary
              aria-label={`Contas de ${sale.clientName}: ${sale.title}`}
              className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 hover:bg-sidebar-hover/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden xl:flex-row xl:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ChevronDown
                  aria-hidden
                  className="mt-1 size-4 shrink-0 text-secundary transition-transform group-open/sale:rotate-180 motion-reduce:transition-none"
                />
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">
                    {sale.clientName}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-secundary">
                    {sale.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secundary">
                    <span>
                      {sale.accountCount}{" "}
                      {sale.accountCount === 1 ? "conta" : "contas"}
                    </span>
                    {sale.overdueCount > 0 && (
                      <span className="text-amber-300">
                        {sale.overdueCount}{" "}
                        {sale.overdueCount === 1
                          ? "conta vencida"
                          : "contas vencidas"}
                      </span>
                    )}
                    <span>
                      {sale.nextDueOn
                        ? `Próximo vencimento: ${formatProposalDate(sale.nextDueOn)}`
                        : "Todas as contas quitadas"}
                    </span>
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-x-3 text-xs sm:gap-x-5 sm:text-sm xl:min-w-[420px]">
                {[
                  ["Valor original", sale.total],
                  ["Recebido", sale.received],
                  ["Em aberto", sale.outstanding],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-secundary">{label}</dt>
                    <dd
                      className={`mt-1 break-words font-semibold tabular-nums ${label === "Em aberto" && sale.overdueCount > 0 ? "text-amber-300" : ""}`}
                    >
                      {formatMoney(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </summary>
            <div className="border-t border-sidebar-hover bg-terciary/30">
              <ReceivableList accounts={sale.accounts} />
              <div className="border-t border-sidebar-hover px-5 py-1">
                <Link
                  href={`/financeiro/vendas/${sale.id}`}
                  className="inline-flex min-h-8 items-center rounded text-xs text-secundary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Abrir venda
                </Link>
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
