import { ChevronDown } from "lucide-react";
import { receivableRowGrid } from "./finance-ui";
import type { SaleDetail } from "@/src/server/finance/finance.service";
import { todayInSaoPaulo } from "@/src/server/finance/finance.schema";
import {
  moneyCents,
  formatMoney,
  formatProposalDate,
} from "@/src/server/proposals/proposal.schema";
import { ReceiptForm, ReverseReceipt } from "./receipt-controls";
export function ReceivableCard({
  account,
  compact = false,
}: {
  account: SaleDetail["receivables"][number];
  compact?: boolean;
}) {
  const details = (
    <>
      {compact && (
        <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div>
            <dt className="text-secundary">Valor original</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatMoney(account.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-secundary">Total recebido</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatMoney(account.received)}
            </dd>
          </div>
        </dl>
      )}
      {moneyCents(account.outstanding) > 0 && (
        <ReceiptForm
          accountId={account.id}
          balance={account.outstanding}
          today={todayInSaoPaulo()}
          compact={compact}
        />
      )}
      <details
        open={!compact}
        className={compact ? "mt-3" : "mt-5 border-t border-sidebar-hover pt-4"}
      >
        <summary className="min-h-10 cursor-pointer rounded text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">
          Histórico de recebimentos ({account.receipts.length})
        </summary>
        {account.receipts.length === 0 ? (
          <p className="mt-3 text-sm text-secundary">
            Nenhum pagamento registrado.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-sidebar-hover">
            {account.receipts.map((receipt) => (
              <li key={receipt.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatMoney(receipt.amount)}
                      {receipt.reversal && (
                        <span className="ml-2 text-xs text-secundary">
                          Estornado
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-secundary">
                      {formatProposalDate(receipt.receivedOn)} ·{" "}
                      {receipt.paymentMethod === "PIX" ? "Pix" : "Cartão"}
                    </p>
                  </div>
                  {!receipt.reversal && (
                    <ReverseReceipt
                      receiptId={receipt.id}
                      amount={receipt.amount}
                    />
                  )}
                </div>
                {receipt.notes && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secundary">
                    {receipt.notes}
                  </p>
                )}
                {receipt.reversal && (
                  <p className="mt-2 break-words text-xs text-secundary">
                    Estorno registrado em{" "}
                    {new Date(receipt.reversal.createdAt).toLocaleString(
                      "pt-BR",
                      { timeZone: "America/Sao_Paulo" },
                    )}
                    : {receipt.reversal.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
  if (compact) {
    const paymentLabel = account.paymentMethod === "PIX" ? "Pix" : "Cartão";
    const stateLabel =
      account.status === "Recebido"
        ? "Quitada"
        : account.status === "Parcialmente recebido"
          ? "Parcial"
          : "Pendente";
    const statusLabel = `${stateLabel}${account.overdue ? " · Vencida" : ""}`;
    return (
      <details id={`conta-${account.id}`} className="group/account min-w-0">
        <summary
          aria-label={`Conta ${account.sequence}: ${account.description}. ${account.status}${account.overdue ? ", vencida" : ""}. Saldo pendente: ${formatMoney(account.outstanding)}`}
          className={`${receivableRowGrid} min-h-11 cursor-pointer list-none items-center gap-y-1 px-5 py-2 text-sm hover:bg-sidebar-hover/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden`}
        >
          <span
            data-account-column="description"
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 font-medium"
            title={account.description}
          >
            <span className="truncate">{account.description}</span>
            <ChevronDown
              aria-hidden
              className="size-3 shrink-0 text-secundary group-open/account:rotate-180 xl:hidden"
            />
          </span>
          <span
            data-account-column="due"
            className="hidden whitespace-nowrap text-xs text-secundary xl:col-start-2 xl:row-start-1 xl:block"
          >
            {formatProposalDate(account.dueOn)}
          </span>
          <span
            data-account-column="payment"
            className="hidden text-xs text-secundary xl:col-start-3 xl:row-start-1 xl:block"
          >
            {paymentLabel}
          </span>
          <span
            data-account-column="status"
            title={account.status}
            className={`col-start-2 row-start-2 whitespace-nowrap text-right text-xs xl:col-start-4 xl:row-start-1 xl:text-left ${account.overdue ? "text-amber-300" : account.status === "Recebido" ? "text-primary" : "text-secundary"}`}
          >
            {statusLabel}
          </span>
          <span
            data-account-column="balance"
            className={`col-start-2 row-start-1 whitespace-nowrap text-right font-medium tabular-nums xl:col-start-5 ${account.overdue ? "text-amber-300" : ""}`}
          >
            {formatMoney(account.outstanding)}
          </span>
          <ChevronDown
            aria-hidden
            className="hidden size-3.5 justify-self-end text-secundary group-open/account:rotate-180 xl:col-start-6 xl:row-start-1 xl:block"
          />
          <span className="col-start-1 row-start-2 truncate text-xs text-secundary xl:hidden">
            {formatProposalDate(account.dueOn)} · {paymentLabel}
          </span>
        </summary>
        <div className="px-5 pb-3 pt-1">{details}</div>
      </details>
    );
  }

  return (
    <article className="min-w-0 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-secundary">
            Conta {account.sequence}
          </p>
          <h3 className="font-semibold">{account.description}</h3>
          <p className="mt-1 text-sm text-secundary">
            {formatProposalDate(account.dueOn)} ·{" "}
            {account.paymentMethod === "PIX" ? "Pix" : "Cartão de crédito"}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs">
            <span className="text-secundary">{account.status}</span>
            {account.overdue && <span className="text-amber-300">Vencido</span>}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-secundary">Valor original</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatMoney(account.amount)}
          </p>
          <p className="mt-1 text-xs text-secundary">
            Recebido: {formatMoney(account.received)}
          </p>
          <p className="mt-1 text-xs text-secundary">
            Pendente: {formatMoney(account.outstanding)}
          </p>
        </div>
      </header>
      {details}
    </article>
  );
}

export function ReceivableList({
  accounts,
  title = "Contas desta venda",
}: {
  accounts: SaleDetail["receivables"];
  title?: string;
}) {
  return (
    <>
      <div
        className={`${receivableRowGrid} items-center border-b border-sidebar-hover px-5 py-2 text-xs text-secundary`}
      >
        <h3 data-account-column="description" className="font-medium">
          {title}
        </h3>
        <span data-account-column="due" className="hidden xl:block">
          Vencimento
        </span>
        <span data-account-column="payment" className="hidden xl:block">
          Forma
        </span>
        <span data-account-column="status" className="hidden xl:block">
          Status
        </span>
        <span data-account-column="balance" className="text-right">
          Em aberto
        </span>
      </div>
      <div className="divide-y divide-sidebar-hover">
        {accounts.map((account) => (
          <ReceivableCard key={account.id} account={account} compact />
        ))}
      </div>
    </>
  );
}
