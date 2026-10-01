import type { EstablishmentCandidateDTO } from "../../server/places/places.dto";
import { EstablishmentCard } from "../establishment/establishment-card";

interface DiscoveryResultsProps {
  places: EstablishmentCandidateDTO[];
}

export function DiscoveryResults({ places }: DiscoveryResultsProps) {
  if (places.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">
        Resultados encontrados ({places.length})
      </h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {places.map((place) => (
          <EstablishmentCard key={place.placeId} establishment={place} />
        ))}
      </div>
    </section>
  );
}
