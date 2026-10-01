import type {
  EstablishmentCandidateDTO,
  GooglePlace,
  GoogleTextSearchResponse,
} from "./places.dto";

import { PreliminaryScoreService } from "../scoring/preliminary-score.service";

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

const preliminaryScoreService = new PreliminaryScoreService();

export class PlacesService {
  async search(
    category: string,
    city: string,
    state: string,
    limit: 20 | 40 | 60,
  ): Promise<EstablishmentCandidateDTO[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY não está configurada.");
    }

    const textQuery = `${category} em ${city}, ${state}, Brasil`;

    const places: GooglePlace[] = [];

    let pageToken: string | undefined;

    while (places.length < limit) {
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
            "nextPageToken",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery,
          pageSize: 20,
          languageCode: "pt-BR",
          ...(pageToken && {
            pageToken,
          }),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
          `Erro ao consultar Google Places: ${response.status} - ${errorBody}`,
        );
      }

      const data: GoogleTextSearchResponse = await response.json();

      places.push(...(data.places ?? []));

      if (!data.nextPageToken) {
        break;
      }

      pageToken = data.nextPageToken;
    }

    const uniquePlaces = Array.from(
      new Map(places.map((place) => [place.id, place])).values(),
    );

    return uniquePlaces
      .slice(0, limit)
      .map((place) => this.toCandidateDTO(place));
  }

  private toCandidateDTO(place: GooglePlace): EstablishmentCandidateDTO {
    const website = place.websiteUri ?? null;

    const phone = place.internationalPhoneNumber ?? null;

    const rating = place.rating ?? null;

    const userRatingCount = place.userRatingCount ?? 0;

    const score = preliminaryScoreService.calculate({
      website,
      phone,
      rating,
      userRatingCount,
    });

    return {
      placeId: place.id,
      name: place.displayName?.text ?? "Nome não informado",
      phone,
      rating,
      userRatingCount,
      photoName: place.photos?.[0]?.name ?? null,
      website,
      address: place.formattedAddress ?? "",
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      score,
    };
  }
}
