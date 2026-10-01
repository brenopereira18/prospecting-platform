import { Globe, MapPin, Phone, Star } from "lucide-react";

import type { EstablishmentCandidateDTO } from "../../server/places/places.dto";

interface EstablishmentCardProps {
  establishment: EstablishmentCandidateDTO;
}

export function EstablishmentCard({ establishment }: EstablishmentCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-sidebar-hover bg-terciary shadow">
      {establishment.photoName ? (
        <div className="h-44 w-full overflow-hidden">
          <img
            src={`/api/places/photo?name=${encodeURIComponent(
              establishment.photoName,
            )}`}
            alt={establishment.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-sidebar-hover text-sm text-secundary">
          Sem foto disponível
        </div>
      )}

      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug tracking-tight">
            {establishment.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6 pt-0 text-sm text-secundary">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{establishment.address}</span>
        </p>

        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0" />

          <span>{establishment.phone ?? "Telefone não identificado"}</span>
        </p>

        <p className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0" />

          <span>{establishment.website ?? "Site não identificado"}</span>
        </p>

        <p className="flex items-center gap-2">
          <Star className="h-4 w-4 shrink-0" />

          <span>
            {establishment.rating !== null
              ? `${establishment.rating} · ${establishment.userRatingCount} avaliações`
              : "Sem avaliações"}
          </span>
        </p>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Score de oportunidade
            </span>

            <span className="text-sm font-semibold text-primary">
              {establishment.score}/100
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-sidebar-hover">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${establishment.score}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-sidebar-hover px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-sidebar-hover"
          >
            Cadastrar Lead
          </button>
        </div>
      </div>
    </article>
  );
}
