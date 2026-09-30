"use client";

import { useState } from "react";
import type { CityDTO } from "../../server/location/location.dto";

interface CitySelectProps {
  cities: CityDTO[];
  disabled: boolean;
}

export function CitySelect({ cities, disabled }: CitySelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityDTO | null>(null);

  function handleSelect(city: CityDTO) {
    setSelectedCity(city);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <span>{selectedCity ? selectedCity.name : "Selecione"}</span>

        <span className="text-secundary">⌄</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sidebar-hover bg-terciary py-1 shadow-lg">
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => handleSelect(city)}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover"
            >
              {city.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
