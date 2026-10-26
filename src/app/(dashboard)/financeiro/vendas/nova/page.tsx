import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  ProposalService,
  ProposalError,
} from "@/src/server/proposals/proposal.service";
import { todayInSaoPaulo } from "@/src/server/finance/finance.schema";
import { SaleForm } from "@/src/components/finance/sale-form";
export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ proposal?: string; lead?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  if (
    !z.uuid().safeParse(query.proposal).success ||
    !z.uuid().safeParse(query.lead).success
  )
    notFound();
  const proposal = await new ProposalService(prisma)
    .get(query.proposal!, query.lead!, user.id)
    .catch((e) => {
      if (e instanceof ProposalError && e.code === "NOT_FOUND") notFound();
      throw e;
    });
  const existing = await prisma.sale.findFirst({
    where: {
      proposalId: proposal.id,
      userId: user.id,
      lead: { userId: user.id },
    },
    select: { id: true },
  });
  if (existing) redirect(`/financeiro/vendas/${existing.id}`);
  const lead = await prisma.lead.findFirst({
    where: { id: proposal.leadId, userId: user.id },
    select: { status: true },
  });
  const available =
    lead?.status === "GANHO" &&
    proposal.status === "ACEITA" &&
    !proposal.deletedAt;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:p-8">
      <Link
        href={`/leads/${proposal.leadId}?tab=proposals`}
        className="inline-flex min-h-10 items-center rounded text-sm text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        Voltar às propostas do lead
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Registrar venda</h1>
        <p className="mt-2 break-words text-sm text-secundary">
          {proposal.clientName} — {proposal.title}
        </p>
      </header>
      {available ? (
        <SaleForm proposal={proposal} today={todayInSaoPaulo()} />
      ) : (
        <p className="rounded-xl border border-sidebar-hover bg-card p-6">
          Para registrar esta venda, o lead deve estar ganho e a proposta deve
          estar aceita e disponível.
        </p>
      )}
    </div>
  );
}
