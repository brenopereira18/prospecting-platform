"use client";

import { useState } from "react";
import type { CategoryDTO } from "../../server/categories/category.dto";

interface CategorySelectProps {
  categories: CategoryDTO[];
}

export function CategorySelect({ categories }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  function handleSelect(categoryName: string) {
    setSelectedCategory(categoryName);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover"
      >
        <span>{selectedCategory}</span>
        <span className="text-secundary">⌄</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sidebar-hover bg-terciary py-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleSelect("Todas")}
            className="flex w-full px-3 py-2 text-left text-sm hover:bg-sidebar-hover"
          >
            Todas
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleSelect(category.name)}
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
