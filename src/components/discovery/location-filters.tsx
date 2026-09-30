"use client";

import { useState } from "react";

import type { StateDTO, CityDTO } from "../../server/location/location.dto";
import { StateSelect } from "./state-select";
import { CitySelect } from "./city-select";
import { getCitiesByState } from "../../app/actions/location";

interface LocationFiltersProps {
  states: StateDTO[];
}

export function LocationFilters({ states }: LocationFiltersProps) {
  const [selectedState, setSelectedState] = useState<StateDTO | null>(null);
  const [cities, setCities] = useState<CityDTO[]>([]);

  async function handleStateChange(state: StateDTO) {
    setSelectedState(state);
    const cities = await getCitiesByState(state.id);
    setCities(cities);
  }

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Estado</label>

        <StateSelect
          states={states}
          selectedState={selectedState}
          onStateChange={handleStateChange}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Cidade</label>

        <CitySelect cities={cities} disabled={!selectedState} />
      </div>
    </div>
  );
}
