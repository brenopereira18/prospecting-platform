import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import {
  formatMoney,
  formatProposalDate,
  statusLabels,
  type ProposalDTO,
} from "@/src/server/proposals/proposal.schema";
import { ProposalActions } from "./proposal-actions";
export function LeadProposals({
  leadId,
  proposals,
  leadStatus,
  sales = [],
}: {
  leadId: string;
  proposals: ProposalDTO[];
  leadStatus?: string;
  sales?: { id: string; proposalId: string; title: string }[];
}) {
  const salesByProposal = new Map(sales.map((sale) => [sale.proposalId, sale]));
  const listedProposals = new Set(proposals.map((proposal) => proposal.id));
  const archivedSales = sales.filter(
    (sale) => !listedProposals.has(sale.proposalId),
  );
  return (
    <section id="propostas" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Propostas comerciais</h2>
          <p className="mt-1 text-sm text-secundary">
            Serviços, investimento e condições para este estabelecimento.
          </p>
        </div>
        <Link
          href={`/leads/${leadId}/propostas/nova`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nova proposta
        </Link>
      </div>
      {proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sidebar-hover px-6 py-12 text-center">
          <FileText
            className="mx-auto mb-3 size-7 text-secundary"
            aria-hidden="true"
          />
          <p className="font-medium">
            {archivedSales.length
              ? "Nenhuma proposta na listagem"
              : "Nenhuma proposta criada"}
          </p>
          <p className="mt-2 text-sm text-secundary">
            {archivedSales.length
              ? "Crie uma proposta para preparar uma nova oferta."
              : "Prepare a primeira oferta para este lead."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {proposals.map((proposal) => {
            const sale = salesByProposal.get(proposal.id);
            return (
              <article
                key={proposal.id}
                className="flex min-w-0 flex-col rounded-xl border border-sidebar-hover bg-card p-4"
              >
                <h3
                  className="line-clamp-2 break-words font-semibold leading-6"
                  title={proposal.title}
                >
                  {proposal.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <span
                    className={`rounded px-2 py-1 ${proposal.status === "ACEITA" ? "bg-primary/10 text-primary" : "bg-sidebar-hover text-secundary"}`}
                  >
                    {statusLabels[proposal.status]}
                  </span>
                  <span className="text-secundary">
                    Válida até {formatProposalDate(proposal.validUntil)}
                  </span>
                  {sale && (
                    <span className="text-primary">Venda registrada</span>
                  )}
                </div>
                <dl className="mt-3">
                  <dt className="text-xs text-secundary">Desenvolvimento</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {formatMoney(proposal.total)}
                  </dd>
                </dl>
                {proposal.managedHosting && (
                  <p className="mt-2 text-xs leading-5 text-secundary">
                    Hospedagem opcional:{" "}
                    <span className="whitespace-nowrap">
                      {formatMoney(proposal.monthlyAmount!)} / mês
                    </span>
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <div className="border-t border-sidebar-hover pt-3">
                    <ProposalActions
                      proposal={proposal}
                      compact
                      saleId={sale?.id}
                      leadWon={leadStatus === "GANHO"}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {archivedSales.length > 0 && (
        <details className="rounded-lg border border-sidebar-hover px-4">
          <summary className="min-h-11 cursor-pointer py-3 text-sm text-secundary focus-visible:outline-2 focus-visible:outline-primary">
            Vendas de propostas arquivadas ({archivedSales.length})
          </summary>
          <ul className="divide-y divide-sidebar-hover pb-2">
            {archivedSales.map((sale) => (
              <li key={sale.id}>
                <Link
                  href={`/financeiro/vendas/${sale.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 truncate">{sale.title}</span>
                  <span className="shrink-0 text-primary">Abrir venda</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
