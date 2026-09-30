import type {
  EstablishmentCandidateDTO,
  GooglePlace,
  GoogleTextSearchResponse,
} from "./places.dto";

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

export class PlacesService {
  async search(
    category: string,
    city: string,
    state: string,
  ): Promise<EstablishmentCandidateDTO[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY não está configurada.");
    }

    const textQuery = `${category} em ${city}, ${state}, Brasil`;

    const response = await fetch(GOOGLE_PLACES_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.internationalPhoneNumber",
          "places.rating",
          "places.userRatingCount",
          "places.photos",
          "places.websiteUri",
          "places.formattedAddress",
          "places.regularOpeningHours",
        ].join(","),
      },

      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        languageCode: "pt-BR",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `Erro ao consultar Google Places: ${response.status} - ${errorBody}`,
      );
    }

    const data: GoogleTextSearchResponse = await response.json();

    return (data.places ?? []).map((place) => this.toCandidateDTO(place));
  }

  private toCandidateDTO(place: GooglePlace): EstablishmentCandidateDTO {
    return {
      placeId: place.id,
      name: place.displayName?.text ?? "Nome não informado",
      phone: place.internationalPhoneNumber ?? null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? 0,
      photoName: place.photos?.[0]?.name ?? null,
      website: place.websiteUri ?? null,
      address: place.formattedAddress ?? "",
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    };
  }
}
