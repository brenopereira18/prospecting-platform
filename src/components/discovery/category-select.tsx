"use client";

import { useState, useEffect, useRef } from "react";
import type { CategoryDTO } from "../../server/categories/category.dto";

interface CategorySelectProps {
  categories: CategoryDTO[];
  selectedCategory: CategoryDTO | null;
  onCategoryChange: (category: CategoryDTO) => void;
}

export function CategorySelect({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategorySelectProps) {
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

  function handleSelect(category: CategoryDTO) {
    onCategoryChange(category);
    setOpen(false);
  }

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover"
      >
        <span>{selectedCategory ? selectedCategory.name : "Selecione"}</span>
        <span className="text-secundary">⌄</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sidebar-hover bg-terciary py-1 shadow-lg custom-scrollbar">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleSelect(category)}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover"
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
