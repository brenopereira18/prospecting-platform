"use server";

import { LocationService } from "../../server/location/location.service";

const locationService = new LocationService();

export async function getCitiesByState(stateId: number) {
  return locationService.listCitiesByState(stateId);
}
