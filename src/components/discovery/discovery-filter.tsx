"use client";

import { useState } from "react";

import { Search } from "lucide-react";

import type { CategoryDTO } from "../../server/categories/category.dto";
import { CategorySelect } from "./category-select";
import { getCitiesByState } from "../../app/actions/location";
import type { CityDTO, StateDTO } from "../../server/location/location.dto";
import { CitySelect } from "./city-select";
import { StateSelect } from "./state-select";
import { searchPlaces } from "@/src/app/actions/places";
import type { EstablishmentCandidateDTO } from "@/src/server/places/places.dto";

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
  const [places, setPlaces] = useState<EstablishmentCandidateDTO[]>([]);
  const [cities, setCities] = useState<CityDTO[]>([]);

  async function handleStateChange(state: StateDTO) {
    setSelectedState(state);
    setSelectedCity(null);
    setCities([]);

    const cities = await getCitiesByState(state.id);

    setCities(cities);
  }

  async function handleSearch() {
    if (!selectedState || !selectedCity || !selectedCategory) {
      return;
    }

    const results = await searchPlaces(
      selectedCategory.name,
      selectedCity.name,
      selectedState.name,
    );

    setPlaces(results);
  }

  return (
    <div className="grid gap-4 p-6 md:grid-cols-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">País</label>

        <button
          type="button"
          disabled
          className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm disabled:cursor-default"
        >
          <span>Brasil</span>
        </button>
      </div>

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

      <div className="space-y-2">
        <label className="text-sm font-medium">Categoria</label>

        <CategorySelect
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      <div className="flex items-end">
        <button
          type="button"
          onClick={handleSearch}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-background shadow transition-colors hover:opacity-90"
        >
          <Search className="mr-2 h-4 w-4" />
          Pesquisar
        </button>
      </div>
    </div>
  );
}
