import { Globe, MapPin, Phone, Star } from "lucide-react";

import type { LeadListItemDTO } from "../../server/leads/lead.dto";
import { LEAD_STATUS_LABELS } from "@/src/constants/lead-status";

interface LeadCardProps {
  lead: LeadListItemDTO;
}

export function LeadCard({ lead }: LeadCardProps) {
  const score = lead.score ?? 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-sidebar-hover bg-terciary shadow">
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug tracking-tight">
              {lead.name}
            </h3>

            <p className="mt-1 text-sm text-secundary">{lead.category.name}</p>
          </div>

          <span className="shrink-0 rounded-full border border-sidebar-hover px-2.5 py-1 text-xs font-medium">
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6 pt-0 text-sm text-secundary">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{lead.address ?? "Endereço não identificado"}</span>
        </p>

        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0" />

          <span>{lead.phone ?? "Telefone não identificado"}</span>
        </p>

        <p className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0" />

          <span>{lead.website ?? "Site não identificado"}</span>
        </p>

        <p className="flex items-center gap-2">
          <Star className="h-4 w-4 shrink-0" />

          <span>
            {lead.rating !== null
              ? `${lead.rating} · ${lead.userRatingCount ?? 0} avaliações`
              : "Sem avaliações"}
          </span>
        </p>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Score de oportunidade
            </span>

            <span className="text-sm font-semibold text-primary">
              {score}/100
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-sidebar-hover">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${score}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-sidebar-hover px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-sidebar-hover"
          >
            Ver lead
          </button>
        </div>
      </div>
    </article>
  );
}
