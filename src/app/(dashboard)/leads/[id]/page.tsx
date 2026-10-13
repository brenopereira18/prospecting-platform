import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";
import { LEAD_STATUS_LABELS } from "@/src/constants/lead-status";
import { LeadTabs } from "@/src/components/leads/lead-tabs";
import { LeadAnalysis } from "@/src/components/leads/lead-analysis";
import { PreliminaryScoreService } from "@/src/server/scoring/preliminary-score.service";

interface LeadDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const leadService = new LeadService();

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const lead = await leadService.findById(id, user.id);

  if (!lead) {
    notFound();
  }

  const preliminaryScoreService = new PreliminaryScoreService();

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
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {lead.name}
            </h1>

            <p className="mt-1 text-sm text-secundary">
              {lead.category.name}
              {lead.address && ` · ${lead.address}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-40 items-center justify-between gap-3 rounded-md border border-sidebar-hover bg-terciary px-3 text-sm text-foreground">
              <span>{LEAD_STATUS_LABELS[lead.status]}</span>
              <span className="text-secundary">⌄</span>
            </div>

            <button
              type="button"
              disabled
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gerar protótipo
            </button>
          </div>
        </header>

        {/* Indicadores */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-sidebar-hover bg-terciary px-2.5 py-1 text-xs font-medium text-foreground">
            {LEAD_STATUS_LABELS[lead.status]}
          </span>

          <span className="inline-flex items-center rounded-md border border-sidebar-hover bg-terciary px-2.5 py-1 text-xs font-medium text-foreground">
            Score preliminar {lead.score ?? "Não calculado"}
          </span>

          {lead.phone && (
            <span className="inline-flex items-center rounded-md border border-sidebar-hover bg-terciary px-2.5 py-1 text-xs text-secundary">
              {lead.phone}
            </span>
          )}

          <span className="inline-flex items-center rounded-md border border-sidebar-hover bg-terciary px-2.5 py-1 text-xs text-secundary">
            {lead.website ? "Site identificado" : "Sem site identificado"}
          </span>
        </div>

        {/* Conteúdo principal */}
        <LeadTabs
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
        />
      </div>
    </div>
  );
}
