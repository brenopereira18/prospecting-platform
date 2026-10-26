import {
  formatMoney,
  formatProposalDate,
  type ProposalDTO,
} from "@/src/server/proposals/proposal.schema";
import {
  proposalReference,
  proposalSections,
} from "@/src/server/proposals/proposal-presentation";

export function ProposalDocument({ proposal }: { proposal: ProposalDTO }) {
  return (
    <article className="overflow-hidden rounded-xl border border-sidebar-hover bg-card">
      <header className="space-y-5 border-b border-sidebar-hover p-5 sm:p-8">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-secundary">
          <span>Proposta {proposalReference(proposal)}</span>
          <span>{formatProposalDate(proposal.createdAt)}</span>
        </div>
        <h2 className="break-words text-2xl font-semibold tracking-tight">
          {proposal.title}
        </h2>
        <div className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-secundary">Preparada para</p>
            <p className="font-medium">{proposal.clientName}</p>
            {proposal.clientAddress && (
              <p className="mt-1 text-secundary">{proposal.clientAddress}</p>
            )}
            {proposal.clientPhone && (
              <p className="mt-1 text-secundary">{proposal.clientPhone}</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-secundary">Responsável pela proposta</p>
            <p className="font-medium">{proposal.issuerName}</p>
            <p className="mt-1 break-all text-secundary">
              {proposal.issuerEmail}
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-primary/10 px-5 py-4">
          <p className="text-sm text-secundary">
            Investimento em desenvolvimento
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">
            {formatMoney(proposal.total)}
          </p>
        </div>
      </header>
      <div className="space-y-7 p-5 sm:p-8">
        {proposalSections(proposal).map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 font-semibold">{section.title}</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-secundary [overflow-wrap:anywhere]">
              {section.text}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
