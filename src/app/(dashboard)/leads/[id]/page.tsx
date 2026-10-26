import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  MapPin,
  Phone,
  Star,
  WandSparkles,
} from "lucide-react";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";
import { prisma } from "@/lib/prisma/client";
import { LeadStatusService } from "@/src/server/leads/lead-status.service";
import { LeadStatusControl } from "@/src/components/leads/lead-status-control";
import { LeadStatusHistory } from "@/src/components/leads/lead-status-history";
import { LeadTabs } from "@/src/components/leads/lead-tabs";
import { LeadAnalysis } from "@/src/components/leads/lead-analysis";
import { PreliminaryScoreService } from "@/src/server/scoring/preliminary-score.service";
import { approachTemplateService } from "@/src/server/approach-templates/approach-template.service";
import { LeadApproach } from "@/src/components/leads/lead-approach";
import { LeadInteractions } from "@/src/components/leads/lead-interaction";
import { leadInteractionService } from "@/src/server/lead-interactions/lead-interaction.service";
import { prototypeService } from "@/src/server/prototypes/prototype.service";
import { LeadPrototypes } from "@/src/components/prototypes/lead-prototypes";

import { FinanceService } from "@/src/server/finance/finance.service";
import { ProposalService } from "@/src/server/proposals/proposal.service";
import { LeadProposals } from "@/src/components/proposals/lead-proposals";

interface LeadDetailPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{
    id: string;
  }>;
}

const leadService = new LeadService();
const leadStatusService = new LeadStatusService(prisma);

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const lead = await leadService.findById(id, user.id);

  if (!lead) {
    notFound();
  }
  const proposals = await new ProposalService(prisma).list(lead.id, user.id);
  const sales = await new FinanceService(prisma).forLead(lead.id, user.id);
  const statusHistory = await leadStatusService.history(lead.id, user.id);
  const { prototypes } = await prototypeService.leadCreationOptions(
    lead.id,
    user.id,
  );
  const query = (await searchParams) ?? {};
  const selectedPrototypeId = prototypes.find(
    (prototype) => prototype.id === query.prototype,
  )?.id;
  const initialTab =
    query.tab === "prototypes" || selectedPrototypeId
      ? "prototypes"
      : query.tab === "proposals"
        ? "proposals"
        : "analysis";

  const preliminaryScoreService = new PreliminaryScoreService();
  const approachTemplates = await approachTemplateService.findByCategory(
    lead.category.id,
  );
  const interactions = await leadInteractionService.findByLead(
    lead.id,
    user.id,
  );

  const analysis =
    lead.score !== null
      ? preliminaryScoreService.calculateDetailed({
          website: lead.website,
          phone: lead.phone,
          rating: lead.rating,
          userRatingCount: lead.userRatingCount ?? 0,
        })
      : null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <Link
          href="/leads"
          className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-secundary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para leads
        </Link>

        <header className="overflow-hidden rounded-2xl border border-sidebar-hover bg-card">
          <div className="flex flex-col justify-between gap-6 p-5 sm:p-7 xl:flex-row xl:items-start">
            <div className="flex min-w-0 items-start gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-sm font-medium text-primary [overflow-wrap:anywhere]">
                  {lead.category.name}
                </p>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
                  {lead.name}
                </h1>
                <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-secundary">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="[overflow-wrap:anywhere]">
                    {lead.address ?? "Endereço não identificado"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3 xl:flex-col xl:items-end">
              <div className="flex flex-col items-start gap-1.5 xl:items-end">
                <Link
                  href={`/leads/${lead.id}/prototipos/novo`}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-background hover:opacity-90"
                >
                  <WandSparkles aria-hidden="true" className="size-4" />
                  Gerar protótipo
                </Link>
                {prototypes.length > 0 && (
                  <Link
                    href={`/prototipos/${prototypes[0].id}`}
                    className="text-xs text-primary underline"
                  >
                    Abrir protótipo existente ({prototypes.length})
                  </Link>
                )}
              </div>
            </div>
          </div>

          <dl className="grid border-t border-sidebar-hover bg-terciary/40 md:grid-cols-3">
            <div className="min-w-0 border-b border-sidebar-hover px-5 py-4 sm:px-7 md:border-r md:border-b-0">
              <dt className="flex items-center gap-2 text-xs text-secundary">
                <Phone aria-hidden="true" className="size-3.5" />
                Telefone
              </dt>
              <dd className="mt-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                {lead.phone ?? "Não identificado"}
              </dd>
            </div>
            <div className="min-w-0 border-b border-sidebar-hover px-5 py-4 sm:px-7 md:border-r md:border-b-0">
              <dt className="flex items-center gap-2 text-xs text-secundary">
                <Globe aria-hidden="true" className="size-3.5" />
                Site
              </dt>
              <dd className="mt-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                {lead.website ?? "Não identificado"}
              </dd>
            </div>
            <div className="min-w-0 px-5 py-4 sm:px-7">
              <dt className="flex items-center gap-2 text-xs text-secundary">
                <Star aria-hidden="true" className="size-3.5" />
                Avaliações no Google
              </dt>
              <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-foreground">
                  {lead.rating !== null
                    ? `${lead.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
                    : "Sem nota"}
                </span>
                <span className="text-xs text-secundary">
                  {lead.userRatingCount !== null
                    ? `${lead.userRatingCount.toLocaleString("pt-BR")} avaliações`
                    : "Quantidade não informada"}
                </span>
              </dd>
            </div>
          </dl>
        </header>

        <section
          aria-label="Acompanhamento comercial"
          className="relative rounded-xl border border-sidebar-hover bg-card"
        >
          <div className="px-5 pt-3 pb-1 lg:py-3 lg:pr-48">
            <LeadStatusControl
              leadId={lead.id}
              status={lead.status}
              statusRevision={lead.statusRevision}
            />
          </div>
          <LeadStatusHistory entries={statusHistory} inline />
        </section>

        {/* Conteúdo principal */}
        <LeadTabs
          key={`${initialTab}:${selectedPrototypeId ?? ""}`}
          initialTab={initialTab}
          proposals={
            <LeadProposals
              leadId={lead.id}
              leadStatus={lead.status}
              proposals={proposals}
              sales={sales}
            />
          }
          prototypes={
            <LeadPrototypes
              leadId={lead.id}
              prototypes={prototypes}
              selectedPrototypeId={selectedPrototypeId}
            />
          }
          analysis={
            <LeadAnalysis
              score={lead.score}
              analysis={analysis}
              website={lead.website}
              phone={lead.phone}
              rating={lead.rating}
              userRatingCount={lead.userRatingCount}
            />
          }
          approach={
            <LeadApproach
              leadName={lead.name}
              userName={user.name}
              templates={approachTemplates}
            />
          }
          interactions={
            <LeadInteractions leadId={lead.id} interactions={interactions} />
          }
        />
      </div>
    </div>
  );
}
