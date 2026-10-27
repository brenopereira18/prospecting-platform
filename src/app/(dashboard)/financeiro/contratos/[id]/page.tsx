import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { FinanceError } from "@/src/server/finance/finance.service";
import { RecurringService } from "@/src/server/finance/recurring.service";
import { todayInSaoPaulo } from "@/src/server/finance/finance.schema";
import {
  statusLabels,
  kindLabels,
} from "@/src/server/finance/recurring.schema";
import {
  formatMoney,
  formatProposalDate,
} from "@/src/server/proposals/proposal.schema";
import {
  ContractForm,
  ContractStatusControl,
  GenerateMonthly,
} from "@/src/components/finance/contract-controls";
import { ReceivableList } from "@/src/components/finance/receivable-card";
import {
  financeButton,
  ContractStatusBadge,
} from "@/src/components/finance/finance-ui";

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Math.trunc(Number(query.page) || 1)),
  );
  const row = await new RecurringService(prisma)
    .get(id, user.id, page)
    .catch((error) => {
      if (error instanceof FinanceError && error.code === "NOT_FOUND")
        notFound();
      throw error;
    });
  const terms = {
    kind: row.kind,
    description: row.description,
    monthlyAmount: row.monthlyAmount,
    dueDay: row.dueDay,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:p-8">
      <Link className={financeButton} href="/financeiro/contratos">
        Voltar aos contratos
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">
            {row.sale.clientName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secundary">
            <span>{kindLabels[row.kind]}</span>
            <ContractStatusBadge status={row.status} />
          </div>
          <Link
            href={`/financeiro/vendas/${row.saleId}`}
            className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
          >
            Abrir venda
          </Link>
        </div>
        <ContractStatusControl
          id={id}
          revision={row.revision}
          status={row.status}
        />
      </header>
      <section className="rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-secundary">Valor mensal</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(row.monthlyAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secundary">Vencimento</dt>
            <dd className="mt-1">
              Dia {row.dueDay} ·{" "}
              {row.paymentMethod === "PIX" ? "Pix" : "Cartão"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secundary">Início</dt>
            <dd className="mt-1">{formatProposalDate(row.startsOn)}</dd>
          </div>
        </dl>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6">
          {row.description}
        </p>
        {row.notes && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-secundary">
            {row.notes}
          </p>
        )}
        {row.status !== "CANCELADO" && (
          <details className="mt-5 border-t border-sidebar-hover pt-4">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">
              Editar condições comerciais
            </summary>
            <div className="pt-5">
              <ContractForm
                key={row.revision}
                saleId={row.saleId}
                today={todayInSaoPaulo()}
                initial={{
                  id,
                  revision: row.revision,
                  startsOn: row.startsOn,
                  terms,
                }}
              />
            </div>
          </details>
        )}
      </section>
      <section className="space-y-4">
        <GenerateMonthly
          id={id}
          revision={row.revision}
          startsOn={row.startsOn}
          today={todayInSaoPaulo()}
        />
        <div className="overflow-hidden rounded-xl border border-sidebar-hover bg-card">
          {row.receivables.length ? (
            <ReceivableList
              accounts={row.receivables}
              title="Mensalidade / competência"
            />
          ) : (
            <p className="p-5 text-sm text-secundary">
              Nenhuma mensalidade gerada nesta página.
            </p>
          )}
        </div>
        {(row._count.receivables > 25 || page > 1) && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Página {page}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className={financeButton} href={`?page=${page - 1}`}>
                  Anterior
                </Link>
              )}
              {page * 25 < row._count.receivables && (
                <Link className={financeButton} href={`?page=${page + 1}`}>
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
      <details className="rounded-xl border border-sidebar-hover bg-card">
        <summary className="cursor-pointer p-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">
          Histórico do contrato ({row.history.length})
        </summary>
        <ol className="divide-y divide-sidebar-hover px-5 pb-3">
          {row.history.map((h) => (
            <li key={h.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium">
                  {h.fromStatus && h.fromStatus !== h.toStatus
                    ? `${statusLabels[h.fromStatus]} → `
                    : ""}
                  {h.revision === 0
                    ? "Contrato cadastrado"
                    : h.fromStatus === h.toStatus
                      ? "Condições alteradas"
                      : statusLabels[h.toStatus]}
                </span>
                <time
                  className="text-xs text-secundary"
                  dateTime={h.occurredAt}
                >
                  {new Date(h.occurredAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </time>
              </div>
              <p className="mt-1 break-words text-sm text-secundary">
                {h.reason}
              </p>
              <details className="mt-2 text-xs text-secundary">
                <summary className="cursor-pointer">
                  Condições a partir de{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${h.effectiveMonth}-01T00:00:00Z`))}
                </summary>
                <p className="mt-2">
                  {kindLabels[h.conditions.kind]} ·{" "}
                  {formatMoney(h.conditions.monthlyAmount)} / mês · Dia{" "}
                  {h.conditions.dueDay} ·{" "}
                  {h.conditions.paymentMethod === "PIX" ? "Pix" : "Cartão"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">
                  {h.conditions.description}
                </p>
                {h.conditions.notes && (
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {h.conditions.notes}
                  </p>
                )}
              </details>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
