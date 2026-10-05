"use server";

import { PlacesService } from "../../server/places/places.service";
import { getCurrentUser } from "../../server/auth/current-user.service";
import { LeadService } from "../../server/leads/leads.service";

const placesService = new PlacesService();
const leadService = new LeadService();

export async function searchPlaces(
  category: string,
  city: string,
  state: string,
  limit: 20 | 40 | 60,
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const places = await placesService.search(category, city, state, limit);

  const placeIds = places.map((place) => place.placeId);

  const registeredPlaceIds = await leadService.findRegisteredGooglePlaceIds(
    user.id,
    placeIds,
  );

  return places.map((place) => ({
    ...place,
    isRegistered: registeredPlaceIds.has(place.placeId),
  }));
}
