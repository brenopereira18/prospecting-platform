"use server";

"use server";

import { PlacesService } from "../../server/places/places.service";

const placesService = new PlacesService();

export async function searchPlaces(
  category: string,
  city: string,
  state: string,
) {
  return placesService.search(category, city, state);
}
