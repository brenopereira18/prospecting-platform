"use client";

import { useState, useEffect, useRef } from "react";
import type { StateDTO } from "../../server/location/location.dto";

interface StateSelectProps {
  states: StateDTO[];
  selectedState: StateDTO | null;
  onStateChange: (state: StateDTO) => void;
}

export function StateSelect({
  states,
  selectedState,
  onStateChange,
}: StateSelectProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(state: StateDTO) {
    onStateChange(state);
    setOpen(false);
  }

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover"
      >
        <span>
          {selectedState
            ? `${selectedState.name} - ${selectedState.abbreviation}`
            : "Selecione"}
        </span>

        <span className="text-secundary">⌄</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sidebar-hover bg-terciary py-1 shadow-lg custom-scrollbar">
          {states.map((state) => (
            <button
              key={state.id}
              type="button"
              onClick={() => handleSelect(state)}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover"
            >
              {state.name} - {state.abbreviation}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
