"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useHamburgueriaDocument } from "./document-provider";

interface Interactions {
  category: string | undefined;
  setCategory: (category: string) => void;
}
const Context = createContext<Interactions | null>(null);

export function useInteractions() {
  const context = useContext(Context);
  if (!context)
    throw new Error(
      "Os componentes interativos precisam de InteractionProvider.",
    );
  return context;
}

export function InteractionProvider({ children }: { children: ReactNode }) {
  const { content } = useHamburgueriaDocument();
  const { categories, defaultCategoryId } = content.menu;
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const category = categories.some((item) => item.id === selectedCategory)
    ? selectedCategory
    : (categories.find((item) => item.id === defaultCategoryId)?.id ??
      categories[0]?.id);
  function setCategory(id: string) {
    if (categories.some((item) => item.id === id)) setSelectedCategory(id);
  }
  return (
    <Context.Provider value={{ category, setCategory }}>
      {children}
    </Context.Provider>
  );
}
