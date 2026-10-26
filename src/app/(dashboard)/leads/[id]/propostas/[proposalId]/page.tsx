import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  ProposalService,
  ProposalError,
} from "@/src/server/proposals/proposal.service";
import { statusLabels } from "@/src/server/proposals/proposal.schema";
import { ProposalForm } from "@/src/components/proposals/proposal-form";
import { ProposalDocument } from "@/src/components/proposals/proposal-document";
import { ProposalActions } from "@/src/components/proposals/proposal-actions";
export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; proposalId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, proposalId } = await params;
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(proposalId).success
  )
    notFound();
  const service = new ProposalService(prisma);
  const proposal = await service.get(proposalId, id, user.id).catch((error) => {
    if (error instanceof ProposalError && error.code === "NOT_FOUND")
      notFound();
    throw error;
  });
  const [sale, lead] = await Promise.all([
    prisma.sale.findFirst({
      where: { proposalId, userId: user.id, lead: { userId: user.id } },
      select: { id: true },
    }),
    prisma.lead.findFirst({
      where: { id, userId: user.id },
      select: { status: true },
    }),
  ]);
  const editing =
    (await searchParams).edit === "1" &&
    proposal.status === "RASCUNHO" &&
    !proposal.lockedAt &&
    !proposal.deletedAt;
  const history = await service.history(proposal.id, id, user.id);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:p-8">
      <Link
        href={`/leads/${id}?tab=proposals`}
        className="inline-flex min-h-10 items-center gap-2 rounded text-sm text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Propostas do lead
      </Link>
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {editing ? "Editar proposta" : "Proposta comercial"}
          </h1>
          <span className="rounded-md bg-sidebar-hover px-2.5 py-1 text-xs text-secundary">
            {proposal.deletedAt
              ? "Excluída da listagem"
              : statusLabels[proposal.status]}
          </span>
        </div>
        {proposal.sourceProposalId && (
          <Link
            href={`/leads/${id}/propostas/${proposal.sourceProposalId}`}
            className="inline-block text-sm text-primary underline underline-offset-4"
          >
            Ver proposta de origem
          </Link>
        )}
        {proposal.lockedAt && (
          <p className="text-sm text-secundary">
            Conteúdo preservado. Duplique como rascunho para preparar uma nova
            oferta.
          </p>
        )}
        {!editing && (
          <ProposalActions
            key={`${proposal.id}:${proposal.revision}`}
            proposal={proposal}
          />
        )}
        {sale ? (
          <Link
            href={`/financeiro/vendas/${sale.id}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-sidebar-hover px-4 text-sm text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            Abrir venda registrada
          </Link>
        ) : proposal.status === "ACEITA" &&
          lead?.status === "GANHO" &&
          !proposal.deletedAt ? (
          <Link
            href={`/financeiro/vendas/nova?lead=${id}&proposal=${proposal.id}`}
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Registrar venda
          </Link>
        ) : null}
      </header>
      {editing ? (
        <ProposalForm
          key={proposal.revision}
          leadId={id}
          clientName={proposal.clientName}
          proposal={proposal}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <ProposalDocument proposal={proposal} />
          <aside className="rounded-xl border border-sidebar-hover bg-card p-5">
            <h2 className="text-sm font-semibold">Histórico da proposta</h2>
            <ol className="mt-4 space-y-4 text-xs">
              {history.length === 0 && (
                <li className="text-secundary">Rascunho ainda não enviado.</li>
              )}
              {history.map((entry) => (
                <li key={entry.id}>
                  <p>
                    {statusLabels[entry.fromStatus]} →{" "}
                    {statusLabels[entry.toStatus]}
                  </p>
                  <time
                    className="mt-1 block text-secundary"
                    dateTime={entry.occurredAt.toISOString()}
                  >
                    {entry.occurredAt.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </li>
              ))}
            </ol>
            {proposal.status === "ACEITA" && (
              <p className="mt-5 border-t border-sidebar-hover pt-4 text-xs leading-5 text-secundary">
                Aceitação comercial registrada. Não representa pagamento
                recebido.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
