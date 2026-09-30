import type { CityDTO, StateDTO, IBGEState, IBGECity } from "./location.dto";

const IBGE_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";

export class LocationService {
  async listStates(): Promise<StateDTO[]> {
    const response = await fetch(`${IBGE_API_URL}/estados?orderBy=nome`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Não foi possível carregar os estados.");
    }

    const states: IBGEState[] = await response.json();

    return states.map((state) => ({
      id: state.id,
      name: state.nome,
      abbreviation: state.sigla,
    }));
  }

  async listCitiesByState(stateId: number): Promise<CityDTO[]> {
    const response = await fetch(
      `${IBGE_API_URL}/estados/${stateId}/municipios?orderBy=nome`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Não foi possível carregar os municípios.");
    }

    const cities: IBGECity[] = await response.json();

    return cities.map((city) => ({
      id: city.id,
      name: city.nome,
    }));
  }
}
