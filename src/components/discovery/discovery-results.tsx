import type { EstablishmentCandidateDTO } from "../../server/places/places.dto";
import { EstablishmentCard } from "../establishment/establishment-card";

interface DiscoveryResultsProps {
  places: EstablishmentCandidateDTO[];
  categoryId: string | null;
}

export function DiscoveryResults({
  places,
  categoryId,
}: DiscoveryResultsProps) {
  if (places.length === 0 || !categoryId) {
    return null;
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">
        Resultados encontrados ({places.length})
      </h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {places.map((place) => (
          <EstablishmentCard
            key={place.placeId}
            establishment={place}
            categoryId={categoryId}
          />
        ))}
      </div>
    </section>
  );
}
