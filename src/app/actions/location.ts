"use server";

import { after } from "next/server";
import { LocationService } from "../../server/location/location.service";
import { logIbgeNetworkDiagnostics } from "../../server/location/location-diagnostics";

const locationService = new LocationService();

export async function getCitiesByState(stateId: number) {
  try {
    return await locationService.listCitiesByState(stateId);
  } catch (error) {
    after(() => logIbgeNetworkDiagnostics(stateId));
    throw error;
  }
}
