import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";
import { ProposalForm } from "@/src/components/proposals/proposal-form";
export default async function NewProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const lead = await new LeadService().findById(id, user.id);
  if (!lead) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 sm:p-8">
      <Link
        href={`/leads/${id}?tab=proposals`}
        className="inline-flex min-h-10 items-center gap-2 rounded text-sm text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Propostas do lead
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Nova proposta</h1>
        <p className="mt-2 text-sm text-secundary">{lead.name}</p>
      </header>
      <ProposalForm leadId={id} clientName={lead.name} />
    </div>
  );
}
