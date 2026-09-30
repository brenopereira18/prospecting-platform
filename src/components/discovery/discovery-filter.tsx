"use client";

import { useState } from "react";

import type { CategoryDTO } from "../../server/categories/category.dto";
import { CategorySelect } from "./category-select";
import { getCitiesByState } from "../../app/actions/location";
import type { CityDTO, StateDTO } from "../../server/location/location.dto";
import { CitySelect } from "./city-select";
import { StateSelect } from "./state-select";

interface DiscoveryFiltersProps {
  states: StateDTO[];
  categories: CategoryDTO[];
}

export function DiscoveryFilters({
  states,
  categories,
}: DiscoveryFiltersProps) {
  const [selectedState, setSelectedState] = useState<StateDTO | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityDTO | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDTO | null>(
    null,
  );
  const [cities, setCities] = useState<CityDTO[]>([]);

  async function handleStateChange(state: StateDTO) {
    setSelectedState(state);
    setSelectedCity(null);
    setCities([]);

    const cities = await getCitiesByState(state.id);

    setCities(cities);
  }

  return (
    <>
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

          <CitySelect
            cities={cities}
            selectedCity={selectedCity}
            disabled={!selectedState}
            onCityChange={setSelectedCity}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Categoria</label>

        <CategorySelect
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>
    </>
  );
}
