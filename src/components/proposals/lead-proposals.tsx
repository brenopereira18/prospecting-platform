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
}: {
  leadId: string;
  proposals: ProposalDTO[];
}) {
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
          <p className="font-medium">Nenhuma proposta criada</p>
          <p className="mt-2 text-sm text-secundary">
            Prepare a primeira oferta para este lead.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {proposals.map((proposal) => (
            <article
              key={proposal.id}
              className="flex min-w-0 flex-col rounded-xl border border-sidebar-hover bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 min-w-0 break-words font-semibold">
                  {proposal.title}
                </h3>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs ${proposal.status === "ACEITA" ? "bg-primary/10 text-primary" : "bg-sidebar-hover text-secundary"}`}
                >
                  {statusLabels[proposal.status]}
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold tabular-nums">
                {formatMoney(proposal.total)}
              </p>
              <p className="mb-5 mt-1 text-xs text-secundary">
                Válida até {formatProposalDate(proposal.validUntil)}
                {proposal.managedHosting
                  ? ` · Hospedagem opcional: ${formatMoney(proposal.monthlyAmount!)} / mês`
                  : ""}
              </p>
              <div className="mt-auto border-t border-sidebar-hover pt-4">
                <ProposalActions proposal={proposal} compact />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
