import catalog from "./catalog.json";
import type { CityDTO, StateDTO } from "./location.dto";

// Loaded once on the server. Only the selected UF's DTOs reach the client.
const citiesByState = new Map<number, CityDTO[]>();
for (const city of catalog.cities) {
  const cities = citiesByState.get(city.stateId) ?? [];
  cities.push({ id: city.id, name: city.name });
  citiesByState.set(city.stateId, cities);
}

export class LocationService {
  async listStates(): Promise<StateDTO[]> {
    return catalog.states.map((state) => ({ ...state }));
  }

  async listCitiesByState(stateId: number): Promise<CityDTO[]> {
    if (!Number.isInteger(stateId)) return [];
    return (citiesByState.get(stateId) ?? []).map((city) => ({ ...city }));
  }
}
